import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Shield, Plus, Trash2, LayoutTemplate, ArrowLeft, Loader2, AlertTriangle, FileText, FolderOpen, Search, Filter } from 'lucide-react';

import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc, serverTimestamp, query, where } from 'firebase/firestore';
import useAuthStore from '@/store/useAuthStore';

const MASTER_EMAILS = ["luonggioi68@gmail.com"];
const GRADES = ['6', '7', '8', '9', '10', '11', '12', 'HSG'];
const SUBJECTS = ['Tin học', 'Toán học', 'Ngữ văn', 'Tiếng Anh', 'Vật lí', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lí', 'GDCD'];

export default function AdminHocLieu() {
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

  const [formData, setFormData] = useState({ title: '', link: '', grade: '10', subject: 'Tin học', type: 'dethi', fileFormat: 'word' });
  const [isSaving, setIsSaving] = useState(false);
  
  const [documents, setDocuments] = useState([]);
  const [hasSearched, setHasSearched] = useState(false); 
  const [isSearching, setIsSearching] = useState(false);

  const [filterGrade, setFilterGrade] = useState('ALL');
  const [filterSubject, setFilterSubject] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  const checkIsTechType = (typeVal) => ['scratch', 'python', 'c_cpp', 'sql_web', 'ai'].includes(typeVal);
  const isFormTechType = checkIsTechType(formData.type);
  const isFilterTechType = checkIsTechType(filterType);

  const fetchDocuments = async () => {
    setIsSearching(true);
    try {
      let conditions = [];
      if (filterType !== 'ALL') conditions.push(where("type", "==", filterType));

      if (!isFilterTechType) {
        if (filterGrade !== 'ALL') conditions.push(where("grade", "==", filterGrade));
        if (filterSubject !== 'ALL') conditions.push(where("subject", "==", filterSubject));
      }

      const q = query(collection(firestore, "arena_hoc_lieu"), ...conditions);
      const snapshot = await getDocs(q);
      
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      setDocuments(docs);
      setHasSearched(true);
    } catch (error) {
      alert("Lỗi tải dữ liệu: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  // HÀM QUÉT LINK ĐÃ ĐƯỢC NÂNG CẤP THÔNG MINH
  const extractDriveInfo = (url) => {
    if (!url) return null;
    let match;
    
    // 1. Nhận diện Thư mục
    match = url.match(/\/folders\/([a-zA-Z0-9_-]{15,})/);
    if (match) return { id: match[1], isFolder: true };

    // 2. Nhận diện chuẩn Google Docs, Sheets, Slides, Drive File
    match = url.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]{15,})/);
    if (match) return { id: match[1], isFolder: false };

    // 3. Nhận diện tham số id= (Chặn lỗi cắt nhầm vào ouid=)
    match = url.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    if (match) return { id: match[1], isFolder: false };

    // 4. Quét vét các trường hợp /d/ khác
    match = url.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
    if (match) return { id: match[1], isFolder: false };

    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const driveInfo = extractDriveInfo(formData.link);
    if (!driveInfo) return alert('⚠️ Link Google không hợp lệ! Vui lòng copy đúng link chia sẻ.');

    setIsSaving(true);
    try {
      await addDoc(collection(firestore, "arena_hoc_lieu"), {
        title: formData.title,
        driveId: driveInfo.id,
        isFolder: driveInfo.isFolder,
        grade: isFormTechType ? 'N/A' : formData.grade,
        subject: isFormTechType ? 'N/A' : formData.subject,
        type: formData.type,
        fileFormat: driveInfo.isFolder ? 'folder' : formData.fileFormat,
        authorEmail: user.email,
        authorId: user.uid,
        createdAt: serverTimestamp() 
      });
      alert('✅ Tải lên hệ thống thành công!');
      setFormData({ ...formData, title: '', link: '' });
      
      if (hasSearched) fetchDocuments();
    } catch (error) {
      alert('Lỗi: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xác nhận XÓA VĨNH VIỄN tài liệu này?')) return;
    try {
      await deleteDoc(doc(firestore, "arena_hoc_lieu", id));
      setDocuments(documents.filter(d => d.id !== id));
    } catch (error) {
      alert('Lỗi: ' + error.message);
    }
  };

  if (isTeacher === null) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={40}/></div>;
  if (isTeacher === false) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center flex-col text-center p-4">
      <AlertTriangle className="w-20 h-20 md:w-[100px] md:h-[100px] text-red-500 mb-4 animate-pulse"/>
      <h1 className="text-4xl font-black text-white mb-2 uppercase">Cấm Truy Cập</h1>
      <button onClick={() => router.push('/')} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 mt-4 hover:bg-red-600 transition-colors"><ArrowLeft/> Về Trang Chủ</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-20">
      <Head><title>Admin Học Liệu | Arena Edu</title></Head>

      <header className="bg-red-900/20 border-b border-red-500/30 p-4 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 text-lg md:text-xl font-black italic text-red-500 uppercase">
            <Shield fill="currentColor" size={28}/> <span> QUẢN TRỊ HỌC LIỆU</span>
          </div>
          <button onClick={() => router.push('/arena-hoc-lieu')} className="bg-slate-800 text-white px-3 md:px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-2 hover:bg-slate-700">
            <ArrowLeft size={16}/> <span className="hidden sm:inline">Về Thư Viện</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8">
        
        <form onSubmit={handleSave} className="bg-[#1e293b] p-6 md:p-8 rounded-[2rem] border border-red-500/30 shadow-2xl relative overflow-hidden mb-12">
          <div className="absolute top-0 right-0 p-4 opacity-5"><LayoutTemplate size={150}/></div>
          <div className="relative z-10 space-y-6">
            <h2 className="text-2xl font-black text-white uppercase italic tracking-wider mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
              <Plus className="text-red-500"/> Tải Lên Học Liệu Mới
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Phân Loại (Tab)</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-red-500 outline-none font-bold">
                  <option value="dethi">Đề thi đánh giá</option>
                  <option value="khbd">Kế hoạch bài dạy (KHBD)</option>
                  <option value="phuluc">Phụ lục (1, 2, 3)</option>
                  <option value="scratch" className="bg-red-900/50">▶ SCATCH</option>
                  <option value="python" className="bg-red-900/50">▶ PYTHON</option>
                  <option value="c_cpp" className="bg-red-900/50">▶ C / C++</option>
                  <option value="sql_web" className="bg-red-900/50">▶ SQL WEB</option>
                  <option value="ai" className="bg-red-900/50">▶ TRÍ TUỆ NHÂN TẠO (AI)</option>
                </select>
              </div>
              <div className={isFormTechType ? "opacity-30 pointer-events-none" : ""}>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Khối Lớp</label>
                <select disabled={isFormTechType} value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-red-500 outline-none">
                  {GRADES.map(g => <option key={g} value={g}>{g === 'HSG' ? 'Học Sinh Giỏi' : `Khối ${g}`}</option>)}
                </select>
              </div>
              <div className={isFormTechType ? "opacity-30 pointer-events-none" : ""}>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Môn Học</label>
                <select disabled={isFormTechType} value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-red-500 outline-none">
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Định Dạng File</label>
                <select value={formData.fileFormat} onChange={e => setFormData({...formData, fileFormat: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-red-500 outline-none">
                  <option value="word">Word (.doc, .docx)</option>
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="ppt">PowerPoint (.ppt, .pptx)</option>
                  <option value="excel">Excel (.xls, .xlsx)</option>
                  <option value="zip">Nén (.zip, .rar)</option>
                  <option value="other">File khác</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tên Tài Liệu</label>
              <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="VD: Bộ đề ôn thi..." className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white focus:border-red-500 outline-none"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex justify-between items-center">
                <span>Link Drive / Docs / Sheets</span>
                <span className="text-[10px] text-red-400 italic normal-case font-normal">* Hỗ trợ mọi loại link Google</span>
              </label>
              <input type="url" required value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} placeholder="Dán link chia sẻ (Bất kỳ ai có liên kết)..." className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white focus:border-red-500 outline-none"/>
            </div>

            <button type="submit" disabled={isSaving} className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} strokeWidth={3}/>} 
              {isSaving ? 'ĐANG TẢI LÊN...' : 'ĐƯA VÀO HỆ THỐNG'}
            </button>
          </div>
        </form>

        <h2 className="text-xl font-black text-white uppercase italic tracking-wider mb-4">Quản Lý & Dọn Dẹp Học Liệu</h2>
        
        <div className="bg-[#1e293b] p-4 md:p-6 rounded-[2rem] border border-white/10 shadow-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Phân loại</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-red-500 outline-none">
                <option value="ALL">-- Tất cả loại --</option>
                <option value="dethi">Đề thi đánh giá</option>
                <option value="khbd">Kế hoạch bài dạy (KHBD)</option>
                <option value="phuluc">Phụ lục (1, 2, 3)</option>
                <option value="scratch" className="bg-red-900/50">▶ SCATCH</option>
                <option value="python" className="bg-red-900/50">▶ PYTHON</option>
                <option value="c_cpp" className="bg-red-900/50">▶ C / C++</option>
                <option value="sql_web" className="bg-red-900/50">▶ SQL WEB</option>
                <option value="ai" className="bg-red-900/50">▶ TRÍ TUỆ NHÂN TẠO (AI)</option>
              </select>
            </div>
            <div className={isFilterTechType ? "opacity-30 pointer-events-none" : ""}>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Lọc theo Khối</label>
              <select disabled={isFilterTechType} value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-red-500 outline-none">
                <option value="ALL">-- Tất cả --</option>
                {GRADES.map(g => <option key={g} value={g}>{g === 'HSG' ? 'Học Sinh Giỏi' : `Khối ${g}`}</option>)}
              </select>
            </div>
            <div className={isFilterTechType ? "opacity-30 pointer-events-none" : ""}>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Lọc theo Môn</label>
              <select disabled={isFilterTechType} value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-red-500 outline-none">
                <option value="ALL">-- Tất cả --</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={fetchDocuments} disabled={isSearching} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold border border-slate-600 flex items-center justify-center gap-2 transition disabled:opacity-50">
              {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18}/>} LỌC DỮ LIỆU
            </button>
          </div>
        </div>

        <div className="bg-[#1e293b] rounded-[2rem] shadow-2xl overflow-hidden border border-white/5 relative">
          {isSearching && <div className="absolute inset-0 bg-[#1e293b]/50 backdrop-blur-sm z-10"></div>}
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] md:text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Thông tin Tài Liệu</th>
                  <th className="px-6 py-4">Thuộc tính</th>
                  <th className="px-6 py-4 text-right">Quyền Quản Lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {!hasSearched ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-12 text-center text-slate-500 uppercase tracking-widest font-bold">
                      <Filter size={40} className="mx-auto mb-4 opacity-50" /> Chọn bộ lọc và bấm "Lọc dữ liệu"
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-500 italic">Không tìm thấy tài liệu nào.</td></tr>
                ) : (
                  documents.map(doc => {
                    const isOwner = doc.authorEmail === user?.email;
                    const isMaster = MASTER_EMAILS.includes(user?.email);
                    const canDelete = isOwner || isMaster;

                    return (
                      <tr key={doc.id} className="hover:bg-white/5">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white flex items-center gap-2 text-sm">
                            {doc.isFolder ? <FolderOpen size={16} className="text-amber-400"/> : <FileText size={16} className="text-blue-400"/>} {doc.title}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest flex items-center gap-2">
                            <span>Up bởi: <span className={isOwner ? "text-cyan-400 font-bold" : "text-slate-400"}>{doc.authorEmail || 'Ẩn danh'}</span></span>
                            {doc.fileFormat && !doc.isFolder && <span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[8px] text-slate-300">{doc.fileFormat}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {!checkIsTechType(doc.type) ? (
                              <span className="bg-slate-800 px-2 py-1 rounded text-[10px] font-bold mr-2 text-slate-300 uppercase whitespace-nowrap">
                                {doc.grade === 'HSG' ? 'HSG' : `K${doc.grade}`} - {doc.subject}
                              </span>
                          ) : null}
                          <span className="text-[10px] uppercase font-bold text-red-400 bg-red-900/30 px-2 py-1 rounded whitespace-nowrap border border-red-500/20">{doc.type}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {canDelete ? (
                            <button onClick={() => handleDelete(doc.id)} className="text-red-500 hover:text-white hover:bg-red-600 border border-transparent hover:border-red-400 p-2 rounded-xl transition-all shadow-sm" title="Xóa tài liệu">
                              <Trash2 size={18}/>
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[10px] uppercase font-bold bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-700 cursor-not-allowed">Chỉ Đọc</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}