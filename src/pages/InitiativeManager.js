import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { FileText, Plus, Edit, Trash2, Clock, Loader2, ShieldAlert, User, Flame, ChevronLeft, Gamepad2 } from 'lucide-react';

export default function InitiativeManager() {
  const [initiatives, setInitiatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(firestore, "users", currentUser.uid));
          if (userDoc.exists() && userDoc.data().role === 'teacher') {
              setUser(currentUser);
              setIsAuthorized(true);
              fetchInitiatives(currentUser.uid);
          } else {
              setIsAuthorized(false);
              setLoading(false);
          }
        } catch (error) {
          console.error("Lỗi xác thực:", error);
          setIsAuthorized(false);
          setLoading(false);
        }
      } else {
        setIsAuthorized(false);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchInitiatives = async (uid) => {
    try {
      const q = query(collection(firestore, "initiatives"), where("uid", "==", uid), orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInitiatives(list);
    } catch (error) {
      console.error("Lỗi tải danh sách:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("CẢNH BÁO: Thầy có chắc chắn muốn hủy bỏ vũ khí (sáng kiến) này không? Dữ liệu sẽ không thể khôi phục!")) return;
    try {
      await deleteDoc(doc(firestore, "initiatives", id));
      setInitiatives(initiatives.filter(item => item.id !== id));
    } catch (error) {
      alert("Lỗi khi xóa: " + error.message);
    }
  };

  const handleCreateNew = () => window.location.href = '/ArenaInitiative';
  const handleEdit = (id) => window.location.href = `/ArenaInitiative?id=${id}`;

  if (loading || isAuthorized === null) return <div className="min-h-screen bg-[#0a0505] flex justify-center items-center"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;
  
  if (isAuthorized === false) return (
     <div className="min-h-screen bg-[#0a0505] text-white flex flex-col items-center justify-center p-4 text-center">
       <ShieldAlert size={64} className="text-red-500 mb-4 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.5)] rounded-full" />
       <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 mb-2 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">Khu Vực Tuyệt Mật</h1>
       <p className="text-slate-400 mb-8 max-w-md">Chỉ huy hiệu Giáo viên mới có thể mở khóa hệ thống Quản lý Sáng Kiến.</p>
       {/* ĐÃ SỬA: Điều hướng về /dashboard thay vì / */}
       <button onClick={() => window.location.href = '/dashboard'} className="px-8 py-3 bg-slate-900 rounded-xl hover:bg-slate-800 font-bold border border-slate-700 hover:border-orange-500 hover:text-orange-400 transition-all text-white shadow-[0_0_15px_rgba(0,0,0,0.5)]">Trở về Dashboard</button>
     </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0505] text-slate-200 p-4 md:p-8 relative overflow-hidden">
      {/* Nền Neon */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* HEADER BAR */}
        <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-6 border-b border-orange-500/20 pb-6 bg-slate-900/40 p-4 rounded-3xl shadow-inner backdrop-blur-sm">
          
          {/* ĐÃ SỬA: Điều hướng về /dashboard thay vì / */}
          <button onClick={() => window.location.href = '/dashboard'} className="px-5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-2 hover:border-orange-500 hover:text-orange-400 transition-all text-sm font-bold text-slate-400 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] w-full lg:w-auto justify-center">
            <ChevronLeft size={18} /> Quay về Dashboard
          </button>

          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center gap-3 uppercase tracking-wider text-center">
            <Flame className="text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,1)]" size={36} />
            QUẢN LÍ ARENA SÁNG KIẾN
          </h1>

          <button onClick={handleCreateNew} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform uppercase tracking-wide text-sm shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-orange-400/50 w-full lg:w-auto justify-center">
            <Plus size={20} className="drop-shadow-md" /> Viết Sáng kiến mới
          </button>
          
        </div>

        {/* DANH SÁCH SÁNG KIẾN */}
        {initiatives.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/40 rounded-3xl border border-slate-800/80 backdrop-blur-md shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]">
            <div className="w-24 h-24 bg-slate-950 border border-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
                <Gamepad2 size={48} className="text-slate-600" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2 tracking-wide">KHO LƯU TRỮ TRỐNG RỖNG</h2>
            <p className="text-slate-400 text-lg max-w-md mx-auto">Thầy chưa rèn đúc Sáng kiến nào. Hãy bấm nút góc trên bên phải để khởi tạo chiến dịch mới!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {initiatives.map((item) => (
              <div key={item.id} className="bg-slate-900/70 border border-slate-700/50 p-6 rounded-2xl hover:border-orange-500/80 hover:shadow-[0_0_30px_rgba(249,115,22,0.2)] transition-all relative group backdrop-blur-sm flex flex-col h-full">
                
                {/* Viền sáng bên trái khi hover */}
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-yellow-400 via-orange-500 to-red-600 rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(239,68,68,1)]"></div>
                
                <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-black text-white mb-4 line-clamp-3 leading-snug drop-shadow-md">
                        {item.title || "Sáng kiến bí ẩn (Chưa đặt tên)"}
                    </h3>
                    
                    <div className="flex flex-col gap-2 mb-6 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                        <p className="text-xs text-slate-400 flex items-center gap-2 font-medium">
                            <User size={14} className="text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]"/> 
                            <span className="uppercase tracking-wider">Tác giả:</span> <span className="text-slate-200">{item.authorName || 'Chưa cập nhật'}</span>
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-2 font-medium">
                            <Clock size={14} className="text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]"/> 
                            <span className="uppercase tracking-wider">Cập nhật:</span> <span className="text-slate-200">{item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleDateString('vi-VN', { hour: '2-digit', minute:'2-digit' }) : 'Mới đây'}</span>
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 mt-auto">
                  <button onClick={() => handleEdit(item.id)} className="flex-1 py-3 bg-slate-950 text-orange-400 rounded-xl font-black text-sm uppercase tracking-wider flex justify-center items-center gap-2 hover:bg-orange-500 hover:text-white transition-all border border-orange-500/30 hover:shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                    <Edit size={18} /> Tiếp tục
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="px-4 py-3 bg-slate-950 text-red-500 border border-red-900/50 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]" title="Xóa bản nháp">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}