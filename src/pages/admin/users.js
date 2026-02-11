import { useState, useEffect } from 'react';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { 
    Users, Search, Plus, Edit, Trash2, Save, X, 
    Calendar, CheckCircle, AlertTriangle, Clock, 
    GraduationCap, Briefcase, UserCheck, Shield 
} from 'lucide-react';

export default function AdminUserManagement() {
    const [allUsers, setAllUsers] = useState([]);
    const [activeTab, setActiveTab] = useState('TEACHER'); // 'TEACHER' | 'STUDENT'
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('ADD'); 
    const [currentUser, setCurrentUser] = useState({
        id: '', name: '', email: '', role: 'teacher', expireDate: ''
    });

    // 1. HÀM LẤY DỮ LIỆU THÔNG MINH (TÙY TAB)
    const fetchUsers = async () => {
        setLoading(true);
        setAllUsers([]); // Reset list khi chuyển tab
        try {
            let data = [];
            
            if (activeTab === 'TEACHER') {
                // [FIX] Lấy từ 'allowed_emails' cho Giáo viên
                const q = query(collection(firestore, "allowed_emails"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q);
                data = snapshot.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        name: d.email.split('@')[0], // Tạm lấy tên từ email nếu chưa có
                        email: d.email,
                        role: 'teacher',
                        createdAt: d.createdAt,
                        // Mapping trường 'expiredAt' từ dashboard.js sang logic hiển thị
                        expireDateObj: d.expiredAt ? new Date(d.expiredAt.seconds * 1000) : null
                    };
                });
            } else {
                // [FIX] Lấy từ 'student_profiles' cho Học sinh
                // Lưu ý: Nếu collection này chưa có createdAt, ta bỏ orderBy để tránh lỗi index
                const q = collection(firestore, "student_profiles");
                const snapshot = await getDocs(q);
                data = snapshot.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        name: d.displayName || d.name || "Chưa đặt tên",
                        email: d.email || "Không có email",
                        role: 'student',
                        createdAt: d.createdAt || null, // Học sinh có thể không có trường này
                        expireDateObj: null // Học sinh thường không có hạn dùng
                    };
                });
            }
            setAllUsers(data);
        } catch (error) {
            console.error("Lỗi tải dữ liệu:", error);
        } finally {
            setLoading(false);
        }
    };

    // Gọi lại hàm fetch mỗi khi chuyển Tab
    useEffect(() => {
        fetchUsers();
    }, [activeTab]);

    // 2. Lọc danh sách
    const filteredUsers = allUsers.filter(user => 
        (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 3. Xử lý Modal
    const handleOpenModal = (mode, user = null) => {
        setModalMode(mode);
        if (mode === 'EDIT' && user) {
            let dateStr = '';
            if (user.expireDateObj) {
                const d = user.expireDateObj;
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                dateStr = `${year}-${month}-${day}`;
            }
            setCurrentUser({ ...user, expireDate: dateStr });
        } else {
            setCurrentUser({ 
                name: '', email: '', role: activeTab === 'TEACHER' ? 'teacher' : 'student', expireDate: '' 
            });
        }
        setIsModalOpen(true);
    };

    // 4. Lưu dữ liệu (Đúng Collection)
    const handleSave = async () => {
        if (!currentUser.email) return alert("Vui lòng nhập Email!");
        
        setLoading(true);
        try {
            // Chuẩn bị dữ liệu ngày hết hạn
            let expireTimestamp = null;
            if (activeTab === 'TEACHER' && currentUser.expireDate) {
                const d = new Date(currentUser.expireDate);
                d.setHours(23, 59, 59, 999);
                expireTimestamp = d;
            }

            if (activeTab === 'TEACHER') {
                // Xử lý lưu vào 'allowed_emails'
                const teacherData = {
                    email: currentUser.email,
                    expiredAt: expireTimestamp, // Dùng tên trường khớp với dashboard.js
                    // Nếu cần lưu tên, thầy có thể thêm trường name vào allowed_emails
                };

                if (modalMode === 'ADD') {
                    await addDoc(collection(firestore, "allowed_emails"), {
                        ...teacherData,
                        createdAt: serverTimestamp(),
                        addedBy: 'Admin Portal'
                    });
                } else {
                    await updateDoc(doc(firestore, "allowed_emails", currentUser.id), teacherData);
                }
            } else {
                // Xử lý lưu vào 'student_profiles'
                const studentData = {
                    displayName: currentUser.name,
                    email: currentUser.email,
                    // Học sinh có thể thêm các trường khác nếu cần
                };
                if (modalMode === 'ADD') {
                    // Thường học sinh tự đăng ký, nhưng nếu Admin thêm thì tạo doc mới
                    await addDoc(collection(firestore, "student_profiles"), studentData);
                } else {
                    await updateDoc(doc(firestore, "student_profiles", currentUser.id), studentData);
                }
            }

            alert("✅ Thao tác thành công!");
            setIsModalOpen(false);
            fetchUsers();
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Xóa
    const handleDelete = async (id) => {
        if(!confirm("Xóa tài khoản này vĩnh viễn?")) return;
        try {
            const colName = activeTab === 'TEACHER' ? 'allowed_emails' : 'student_profiles';
            await deleteDoc(doc(firestore, colName, id));
            fetchUsers();
        } catch(e) { alert("Lỗi xóa: " + e.message); }
    }

    // Tính trạng thái (Chỉ dùng cho GV)
    const getStatus = (dateObj) => {
        if (!dateObj) return { label: "Chưa kích hoạt", color: "bg-slate-700 text-slate-300" };
        const diffDays = Math.ceil((dateObj - new Date()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: "Đã hết hạn", color: "bg-red-900/50 text-red-400 border border-red-500/50" };
        if (diffDays <= 2) return { label: `Sắp hết hạn (${diffDays} ngày)`, color: "bg-yellow-900/50 text-yellow-400 border border-yellow-500/50 animate-pulse" };
        return { label: `Còn ${diffDays} ngày`, color: "bg-green-900/50 text-green-400 border border-green-500/50" };
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-6 font-sans">
            <header className="max-w-7xl mx-auto mb-8 flex items-center gap-3">
                <div className="bg-orange-600 p-3 rounded-2xl shadow-lg"><Shield size={32} className="text-white"/></div>
                <div>
                    <h1 className="text-3xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
                        Quản Lý Người Dùng
                    </h1>
                    <p className="text-slate-400 text-sm">Trung tâm kiểm soát tài khoản hệ thống</p>
                </div>
            </header>

            <div className="max-w-7xl mx-auto">
                {/* TABS */}
                <div className="flex gap-4 mb-6">
                    <button onClick={() => setActiveTab('TEACHER')} className={`flex-1 py-4 rounded-2xl font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all ${activeTab === 'TEACHER' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-[1.02]' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                        <Briefcase size={20}/> Giáo Viên (Đăng Ký)
                    </button>
                    <button onClick={() => setActiveTab('STUDENT')} className={`flex-1 py-4 rounded-2xl font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all ${activeTab === 'STUDENT' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-[1.02]' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                        <GraduationCap size={20}/> Học Sinh
                    </button>
                </div>

                {/* TOOLBAR */}
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={activeTab === 'TEACHER' ? "Tìm email giáo viên..." : "Tìm tên học sinh..."} className="w-full bg-slate-900 border border-slate-700 pl-12 pr-4 py-3 rounded-xl outline-none focus:border-indigo-500 text-white"/>
                    </div>
                    <button onClick={() => handleOpenModal('ADD')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition hover:scale-105 ${activeTab === 'TEACHER' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                        <Plus size={20} /> {activeTab === 'TEACHER' ? "Cấp Quyền Mới" : "Thêm Học Sinh"}
                    </button>
                </div>

                {/* TABLE */}
                <div className="bg-slate-800/30 rounded-3xl border border-slate-700 overflow-hidden min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold tracking-widest">
                            <tr>
                                <th className="p-5">STT</th>
                                <th className="p-5">Thông Tin Tài Khoản</th>
                                {activeTab === 'TEACHER' && <th className="p-5">Hạn Sử Dụng</th>}
                                {activeTab === 'TEACHER' && <th className="p-5 text-center">Trạng Thái</th>}
                                <th className="p-5 text-right">Hành Động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? <tr><td colSpan="5" className="p-10 text-center text-slate-500">Đang tải dữ liệu...</td></tr> : 
                            filteredUsers.map((user, index) => {
                                const status = getStatus(user.expireDateObj);
                                return (
                                    <tr key={user.id} className="hover:bg-white/5 transition">
                                        <td className="p-5 text-slate-500 font-mono">{index + 1}</td>
                                        <td className="p-5">
                                            <div className="font-bold text-white text-base">{user.name}</div>
                                            <div className="text-slate-500 text-xs italic">{user.email}</div>
                                        </td>
                                        
                                        {activeTab === 'TEACHER' && (
                                            <>
                                                <td className="p-5 font-mono text-sm text-white">
                                                    {user.expireDateObj ? user.expireDateObj.toLocaleDateString('vi-VN') : '--/--/----'}
                                                </td>
                                                <td className="p-5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${status.color}`}>
                                                        {status.label.includes("Sắp") ? <AlertTriangle size={10}/> : <UserCheck size={10}/>}
                                                        {status.label}
                                                    </span>
                                                </td>
                                            </>
                                        )}

                                        <td className="p-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleOpenModal('EDIT', user)} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition tooltip" title="Sửa / Gia hạn">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(user.id)} className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition" title="Xóa">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {!loading && filteredUsers.length === 0 && <div className="text-center p-10 text-slate-500 italic">Danh sách trống (Kiểm tra lại collection Firestore)</div>}
                </div>
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e293b] w-full max-w-lg rounded-3xl border border-slate-600 shadow-2xl p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                            <h2 className="text-2xl font-black uppercase italic text-white flex items-center gap-2">
                                {modalMode === 'ADD' ? <Plus/> : <Edit/>} 
                                {activeTab === 'TEACHER' ? 'Tài Khoản Giáo Viên' : 'Tài Khoản Học Sinh'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="bg-slate-700 p-2 rounded-full hover:bg-red-500 hover:text-white transition"><X size={20}/></button>
                        </div>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Email (Định danh)</label>
                                <input value={currentUser.email} onChange={e => setCurrentUser({...currentUser, email: e.target.value})} disabled={modalMode === 'EDIT' && activeTab === 'TEACHER'} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white font-bold outline-none focus:border-indigo-500 disabled:opacity-50"/>
                            </div>
                            
                            {/* Chỉ cho sửa tên nếu là Học sinh (GV tên thường lấy theo email hoặc tự set) */}
                            {activeTab === 'STUDENT' && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Họ Tên</label>
                                    <input value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white font-bold outline-none focus:border-indigo-500"/>
                                </div>
                            )}

                            {activeTab === 'TEACHER' && (
                                <div className="bg-indigo-900/20 p-5 rounded-2xl border border-indigo-500/30">
                                    <label className="block text-xs font-black text-indigo-400 uppercase mb-3 flex items-center gap-2">
                                        <Calendar size={16}/> Gia Hạn Đến Ngày
                                    </label>
                                    <input type="date" value={currentUser.expireDate} onChange={e => setCurrentUser({...currentUser, expireDate: e.target.value})} className="w-full bg-slate-900 border border-indigo-500/50 rounded-xl p-4 text-white font-mono font-bold text-lg outline-none focus:border-indigo-400 cursor-pointer"/>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-widest transition">Hủy</button>
                            <button onClick={handleSave} disabled={loading} className={`flex-1 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg transition flex items-center justify-center gap-2 ${activeTab === 'TEACHER' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                                {loading ? 'Đang lưu...' : <><Save size={16} /> Lưu Thay Đổi</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}