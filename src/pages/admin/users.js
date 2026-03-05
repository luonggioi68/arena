import { useState, useEffect } from 'react';
import { firestore } from '@/lib/firebase';
import { 
    collection, getDocs, addDoc, updateDoc, doc, deleteDoc, 
    serverTimestamp, query, orderBy, where 
} from 'firebase/firestore';
import { 
    Users, Search, Plus, Edit, Trash2, Save, X, 
    Calendar, CheckCircle, AlertTriangle, Clock, 
    GraduationCap, Briefcase, UserCheck, Shield, Lock, RefreshCcw, Star, Timer,
    LayoutDashboard, UserCog // [FIXED] Đã bổ sung import 2 icon bị thiếu ở đây
} from 'lucide-react';
import Link from 'next/link';

export default function AdminUserManagement() {
    const [allUsers, setAllUsers] = useState([]);
    const [activeTab, setActiveTab] = useState('TEACHER'); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // State Modal Thêm/Sửa đơn lẻ
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('ADD'); 
    const [currentUser, setCurrentUser] = useState({
        id: '', name: '', email: '', role: 'teacher', expireDate: '', grade: '10'
    });

    // State Xử lý hàng loạt
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isResetDateModalOpen, setIsResetDateModalOpen] = useState(false);
    const [bulkExpireDate, setBulkExpireDate] = useState('');
    const [newEmail, setNewEmail] = useState(''); // Cho form thêm nhanh GV

    const MASTER_EMAILS = ["luonggioi68@gmail.com"];

    // --- 1. LẤY DỮ LIỆU ĐỘNG ---
    const fetchUsers = async () => {
        setLoading(true);
        setAllUsers([]); 
        setSelectedUsers([]); 
        try {
            let data = [];
            if (activeTab === 'TEACHER') {
                const q = query(collection(firestore, "allowed_emails"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q);
                data = snapshot.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        name: d.email.split('@')[0], 
                        email: d.email,
                        role: 'teacher',
                        createdAt: d.createdAt,
                        expireDateObj: d.expiredAt ? new Date(d.expiredAt.seconds * 1000) : null
                    };
                });
            } else {
                const q = collection(firestore, "student_profiles");
                const snapshot = await getDocs(q);
                data = snapshot.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        name: d.displayName || d.name || "Chưa đặt tên",
                        email: d.email || "Không có email",
                        role: 'student',
                        grade: d.grade || '10',
                        totalScore: d.totalScore || 0,
                        createdAt: d.createdAt || null, 
                        expireDateObj: null 
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

    useEffect(() => { fetchUsers(); }, [activeTab]);

    const filteredUsers = allUsers.filter(user => 
        (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- 2. XỬ LÝ THÊM NHANH GIÁO VIÊN ---
    const handleQuickAddTeacher = async (e) => {
        e.preventDefault();
        if (!newEmail.includes('@')) return alert("Email không hợp lệ!");
        
        const formattedEmail = newEmail.trim().toLowerCase();
        
        setLoading(true);
        try {
            // Check trùng
            const qCheck = query(collection(firestore, "allowed_emails"), where("email", "==", formattedEmail));
            const snapCheck = await getDocs(qCheck);
            if (!snapCheck.empty) {
                setLoading(false);
                return alert(`❌ Email "${formattedEmail}" đã được cấp quyền trước đó!`);
            }

            const now = new Date(); 
            const expiredDate = new Date(); 
            expiredDate.setFullYear(now.getFullYear() + 1); // Mặc định +1 năm

            await addDoc(collection(firestore, "allowed_emails"), { 
                email: formattedEmail, 
                addedBy: 'Admin', 
                createdAt: serverTimestamp(), 
                expiredAt: expiredDate 
            });
            
            setNewEmail(''); 
            alert("✅ Đã cấp quyền 1 năm cho Giáo viên!");
            fetchUsers();
        } catch (e) { alert(e.message); }
        finally { setLoading(false); }
    };

    // --- 3. XỬ LÝ LƯU (MODAL) ---
    const handleSaveModal = async () => {
        if (!currentUser.email) return alert("Vui lòng nhập Email!");
        const formattedEmail = currentUser.email.trim().toLowerCase();

        setLoading(true);
        try {
            const colName = activeTab === 'TEACHER' ? 'allowed_emails' : 'student_profiles';

            if (modalMode === 'ADD') {
                const qCheck = query(collection(firestore, colName), where("email", "==", formattedEmail));
                const snapCheck = await getDocs(qCheck);
                if (!snapCheck.empty) {
                    setLoading(false);
                    return alert(`❌ Lỗi: Email đã tồn tại!`);
                }
            }

            if (activeTab === 'TEACHER') {
                let expireTimestamp = null;
                if (currentUser.expireDate) {
                    const d = new Date(currentUser.expireDate);
                    d.setHours(23, 59, 59, 999);
                    expireTimestamp = d;
                }
                const teacherData = { email: formattedEmail, expiredAt: expireTimestamp };
                if (modalMode === 'ADD') {
                    await addDoc(collection(firestore, "allowed_emails"), { ...teacherData, createdAt: serverTimestamp(), addedBy: 'Admin' });
                } else {
                    await updateDoc(doc(firestore, "allowed_emails", currentUser.id), teacherData);
                }
            } else {
                const studentData = { displayName: currentUser.name, email: formattedEmail, grade: currentUser.grade };
                if (modalMode === 'ADD') {
                    await addDoc(collection(firestore, "student_profiles"), studentData);
                } else {
                    await updateDoc(doc(firestore, "student_profiles", currentUser.id), studentData);
                }
            }

            alert("✅ Thao tác thành công!");
            setIsModalOpen(false);
            fetchUsers();
        } catch (error) { alert("Lỗi: " + error.message); } 
        finally { setLoading(false); }
    };

    // --- 4. XỬ LÝ XÓA ĐƠN LẺ VÀ KHIÊN BẢO VỆ ---
    const handleDelete = async (id, email) => {
        if(!confirm("Thầy có chắc chắn muốn xóa tài khoản này khỏi hệ thống?")) return;
        
        setLoading(true);
        try {
            if (activeTab === 'STUDENT' && email) {
                const formattedEmail = email.trim().toLowerCase();
                const qCheck = query(collection(firestore, "allowed_emails"), where("email", "==", formattedEmail));
                const snapCheck = await getDocs(qCheck);
                
                if (!snapCheck.empty) {
                    setLoading(false);
                    return alert("⚠️ HỆ THỐNG TỪ CHỐI XÓA:\n\nEmail này là của GIÁO VIÊN đang dùng thử game với vai trò học sinh. Việc xóa sẽ làm hỏng tài khoản gốc của giáo viên đó!");
                }
            }

            const colName = activeTab === 'TEACHER' ? 'allowed_emails' : 'student_profiles';
            await deleteDoc(doc(firestore, colName, id));
            alert("✅ Đã xóa thành công!");
            fetchUsers();
        } catch(e) { alert("Lỗi xóa: " + e.message); } 
        finally { setLoading(false); }
    };

    // --- 5. XỬ LÝ CHỌN VÀ XÓA HÀNG LOẠT ---
    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedUsers(filteredUsers.map(u => u.id));
        else setSelectedUsers([]);
    };

    const handleSelectOne = (id) => {
        if (selectedUsers.includes(id)) setSelectedUsers(selectedUsers.filter(userId => userId !== id));
        else setSelectedUsers([...selectedUsers, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedUsers.length === 0) return;
        if (!window.confirm(`⚠️ CHÚ Ý: Xóa TẬN GỐC ${selectedUsers.length} tài khoản.\nBạn chắc chắn chứ?`)) return;
        
        setLoading(true);
        try {
            const colName = activeTab === 'TEACHER' ? 'allowed_emails' : 'student_profiles';
            const deletePromises = selectedUsers.map(uid => deleteDoc(doc(firestore, colName, uid)));
            await Promise.all(deletePromises);
            
            alert(`✅ Đã xóa ${selectedUsers.length} tài khoản!`);
            fetchUsers();
        } catch (error) { alert("Lỗi xóa hàng loạt: " + error.message); } 
        finally { setLoading(false); }
    };

    // --- 6. XỬ LÝ GIA HẠN HÀNG LOẠT ---
    const handleBulkResetExpireDate = async () => {
        if (selectedUsers.length === 0) return;
        if (!bulkExpireDate) return alert("Vui lòng chọn ngày hết hạn mới!");

        setLoading(true);
        try {
            if (activeTab === 'TEACHER') {
                const d = new Date(bulkExpireDate);
                d.setHours(23, 59, 59, 999);
                const updatePromises = selectedUsers.map(uid => updateDoc(doc(firestore, 'allowed_emails', uid), { expiredAt: d }));
                await Promise.all(updatePromises);
                
                alert(`✅ Đã gia hạn cho ${selectedUsers.length} giáo viên thành công!`);
                setIsResetDateModalOpen(false);
                setBulkExpireDate('');
                fetchUsers();
            }
        } catch (error) { alert("Lỗi gia hạn: " + error.message); } 
        finally { setLoading(false); }
    };

    // Tính trạng thái hạn dùng
    const getStatus = (dateObj) => {
        if (!dateObj) return { label: "VĨNH VIỄN", color: "bg-green-900/50 text-green-400 border border-green-500/50" };
        const diffDays = Math.ceil((dateObj - new Date()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: "ĐÃ HẾT HẠN", color: "bg-red-900/50 text-red-400 border border-red-500/50" };
        if (diffDays <= 2) return { label: `SẮP HẾT HẠN (${diffDays} NGÀY)`, color: "bg-yellow-900/50 text-yellow-400 border border-yellow-500/50 animate-pulse" };
        return { label: `CÒN ${diffDays} NGÀY`, color: "bg-blue-900/50 text-blue-400 border border-blue-500/50" };
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-6 font-sans flex">
            {/* SIDEBAR TÍCH HỢP TỪ DASHBOARD */}
            <aside className="fixed left-0 top-0 h-full w-64 bg-[#020617] text-white flex flex-col border-r border-white/10 shadow-2xl z-50">
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-3 text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 uppercase tracking-tighter">
                        <Shield fill="currentColor" className="text-orange-500" size={32}/> 
                        <span> Arena Edu<br/><span className="text-sm text-white not-italic tracking-widest font-normal">CONNECT</span></span>
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/dashboard" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-slate-400 hover:bg-white/5 transition-all"><LayoutDashboard size={20}/> VỀ TRUNG TÂM</Link>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold bg-pink-600 text-white transition-all"><UserCog size={20}/> QUẢN LÝ NGƯỜI DÙNG</button>
                </nav>
            </aside>

            <main className="flex-1 ml-64 p-8 overflow-y-auto">
                {/* HEADER */}
                <header className="max-w-7xl mx-auto mb-8">
                    <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">Quản Lý Người Dùng</h1>
                    <p className="text-slate-400 font-medium">Cấp quyền và quản lý tài khoản Giáo viên & Học sinh</p>
                </header>

                <div className="max-w-7xl mx-auto">
                    {/* TABS VÀ TOOLBAR */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
                        <div className="flex gap-4">
                            <button onClick={() => setActiveTab('TEACHER')} className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all ${activeTab === 'TEACHER' ? 'bg-pink-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}><Briefcase size={20}/> Giáo Viên</button>
                            <button onClick={() => setActiveTab('STUDENT')} className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all ${activeTab === 'STUDENT' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}><GraduationCap size={20}/> Học Sinh</button>
                        </div>
                        
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm email hoặc tên..." className="w-full bg-slate-900 border border-slate-700 pl-12 pr-4 py-3 rounded-xl outline-none focus:border-pink-500 text-white"/>
                            </div>
                        </div>
                    </div>

                    {/* NÚT THAO TÁC HÀNG LOẠT */}
                    {selectedUsers.length > 0 && (
                        <div className="flex gap-3 mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700 animate-in fade-in">
                            <span className="text-sm font-bold text-slate-400 self-center mr-2">Đã chọn: <span className="text-white">{selectedUsers.length}</span></span>
                            <button onClick={handleBulkDelete} className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition"><Trash2 size={14}/> Xóa Hàng Loạt</button>
                            {activeTab === 'TEACHER' && (
                                <button onClick={() => setIsResetDateModalOpen(true)} className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition"><RefreshCcw size={14}/> Gia Hạn Hàng Loạt</button>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* CỘT TRÁI: FORM CẤP QUYỀN NHANH */}
                        <div className="lg:col-span-1">
                            <div className="bg-[#1e293b] p-6 rounded-[2rem] border border-white/10 shadow-xl sticky top-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`p-2 rounded-lg ${activeTab === 'TEACHER' ? 'bg-pink-600' : 'bg-emerald-600'}`}><Plus size={24} className="text-white"/></div>
                                    <h2 className="text-xl font-bold uppercase text-white">{activeTab === 'TEACHER' ? 'Cấp Quyền Mới' : 'Thêm Học Sinh'}</h2>
                                </div>
                                
                                {activeTab === 'TEACHER' ? (
                                    <form onSubmit={handleQuickAddTeacher} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Email Giáo Viên</label>
                                            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl focus:border-pink-500 outline-none font-bold" placeholder="vidu@gmail.com" required/>
                                        </div>
                                        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-xs text-slate-400 space-y-2">
                                            <div className="flex justify-between"><span>Ngày đăng ký:</span> <span className="text-white font-bold">{new Date().toLocaleDateString('vi-VN')}</span></div>
                                            <div className="flex justify-between"><span>Hết hạn (Mặc định):</span> <span className="text-pink-400 font-bold">+1 Năm</span></div>
                                        </div>
                                        <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white py-3 rounded-xl font-black uppercase shadow-lg flex items-center justify-center gap-2 transition hover:scale-105"><Plus size={20}/> Xác Nhận Cấp Quyền</button>
                                    </form>
                                ) : (
                                    <div className="text-center text-slate-500 py-10">
                                        <GraduationCap size={48} className="mx-auto mb-4 opacity-50"/>
                                        <p className="text-sm">Học sinh sẽ tự động được thêm vào danh sách khi tham gia làm bài lần đầu tiên.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CỘT PHẢI: BẢNG DANH SÁCH */}
                        <div className="lg:col-span-2">
                            <div className="bg-[#1e293b] rounded-[2rem] border border-white/10 shadow-xl overflow-hidden min-h-[500px]">
                                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                    <h2 className="text-xl font-bold uppercase text-white flex items-center gap-2">
                                        <Users size={24} className={activeTab === 'TEACHER' ? 'text-pink-500' : 'text-emerald-500'}/> 
                                        Danh Sách {activeTab === 'TEACHER' ? 'Giáo Viên' : 'Học Sinh'} ({allUsers.length})
                                    </h2>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-900 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                            <tr>
                                                <th className="p-4 w-12 text-center border-r border-white/5"><input type="checkbox" onChange={handleSelectAll} checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length} className="w-4 h-4 rounded bg-slate-800 cursor-pointer"/></th>
                                                <th className="p-4">Tài khoản</th>
                                                {activeTab === 'TEACHER' && <th className="p-4">Thời hạn</th>}
                                                {activeTab === 'TEACHER' && <th className="p-4 text-center">Trạng thái</th>}
                                                {activeTab === 'STUDENT' && <th className="p-4 text-center">Lớp & Điểm</th>}
                                                <th className="p-4 text-right">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {/* MASTER ADMIN ROW */}
                                            {activeTab === 'TEACHER' && MASTER_EMAILS.map((email, i) => (
                                                <tr key={`master-${i}`} className="bg-yellow-500/5">
                                                    <td className="p-4 border-r border-white/5"></td>
                                                    <td className="p-4 font-bold text-white">{email} <span className="text-[10px] bg-yellow-500 text-black px-1 rounded ml-1">MASTER</span></td>
                                                    <td className="p-4 text-slate-500 italic text-sm">Vĩnh viễn</td>
                                                    <td className="p-4 text-center"><span className="text-green-500 text-xs font-bold">Active</span></td>
                                                    <td className="p-4 text-right"><Lock size={16} className="ml-auto text-slate-500"/></td>
                                                </tr>
                                            ))}

                                            {loading ? <tr><td colSpan="6" className="p-10 text-center text-slate-500 animate-pulse">Đang tải dữ liệu...</td></tr> : 
                                            filteredUsers.map((user) => {
                                                const isSelected = selectedUsers.includes(user.id);
                                                const status = activeTab === 'TEACHER' ? getStatus(user.expireDateObj) : null;

                                                return (
                                                    <tr key={user.id} className={`transition group ${isSelected ? 'bg-indigo-900/20' : 'hover:bg-white/5'}`}>
                                                        <td className="p-4 text-center border-r border-white/5"><input type="checkbox" onChange={() => handleSelectOne(user.id)} checked={isSelected} className="w-4 h-4 rounded bg-slate-800 cursor-pointer"/></td>
                                                        <td className="p-4">
                                                            <div className="font-bold text-white">{user.name}</div>
                                                            <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
                                                            {user.createdAt && <div className="text-[9px] text-slate-600 mt-1 uppercase tracking-widest"><Calendar size={8} className="inline"/> ĐK: {new Date(user.createdAt.seconds * 1000).toLocaleDateString('vi-VN')}</div>}
                                                        </td>
                                                        
                                                        {activeTab === 'TEACHER' && (
                                                            <>
                                                                <td className="p-4 text-sm text-slate-300 font-mono">
                                                                    {user.expireDateObj ? user.expireDateObj.toLocaleDateString('vi-VN') : '--/--/----'}
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <span className={`${status.color} px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide`}>
                                                                        {status.label}
                                                                    </span>
                                                                </td>
                                                            </>
                                                        )}

                                                        {activeTab === 'STUDENT' && (
                                                            <td className="p-4 text-center">
                                                                <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-xs font-bold uppercase mr-2">Lớp {user.grade}</span>
                                                                <span className="text-yellow-400 font-black text-sm"><Star size={12} className="inline" fill="currentColor"/> {user.totalScore}</span>
                                                            </td>
                                                        )}

                                                        <td className="p-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => {
                                                                    let dateStr = '';
                                                                    if (user.expireDateObj) {
                                                                        const d = user.expireDateObj;
                                                                        dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                                                    }
                                                                    setCurrentUser({ ...user, expireDate: dateStr });
                                                                    setModalMode('EDIT');
                                                                    setIsModalOpen(true);
                                                                }} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition" title="Sửa">
                                                                    <Edit size={16} />
                                                                </button>
                                                                <button onClick={() => handleDelete(user.id, user.email)} className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition" title="Xóa">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {!loading && filteredUsers.length === 0 && <tr><td colSpan="6" className="p-10 text-center text-slate-500 italic">Chưa có dữ liệu.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODAL SỬA THÔNG TIN */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-[#1e293b] w-full max-w-md rounded-3xl border border-slate-600 shadow-2xl p-8 animate-in zoom-in">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-black uppercase italic text-white flex items-center gap-2"><Edit size={20}/> Sửa Thông Tin</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                            </div>
                            
                            <div className="space-y-4">
                                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label><input value={currentUser.email} disabled className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-500 font-bold outline-none"/></div>
                                {activeTab === 'STUDENT' && (
                                    <>
                                        <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Họ Tên</label><input value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-bold outline-none focus:border-indigo-500"/></div>
                                        <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Lớp</label><input value={currentUser.grade} onChange={e => setCurrentUser({...currentUser, grade: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-bold outline-none focus:border-indigo-500"/></div>
                                    </>
                                )}
                                {activeTab === 'TEACHER' && (
                                    <div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/30">
                                        <label className="block text-xs font-bold text-indigo-400 uppercase mb-2 flex items-center gap-2"><Calendar size={14}/> Ngày Hết Hạn</label>
                                        <input type="date" value={currentUser.expireDate} onChange={e => setCurrentUser({...currentUser, expireDate: e.target.value})} className="w-full bg-slate-900 border border-indigo-500/50 rounded-xl p-3 text-white font-mono outline-none focus:border-indigo-400"/>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleSaveModal} disabled={loading} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold uppercase shadow-lg transition flex items-center justify-center gap-2"><Save size={18} /> Lưu Thay Đổi</button>
                        </div>
                    </div>
                )}

                {/* MODAL GIA HẠN HÀNG LOẠT */}
                {isResetDateModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in">
                        <div className="bg-[#1e293b] border border-indigo-500 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-4 text-center">Gia Hạn Hàng Loạt</h2>
                            <p className="text-slate-300 text-sm text-center mb-6">Đang chọn <span className="text-yellow-400 font-black">{selectedUsers.length}</span> tài khoản để cập nhật ngày hết hạn mới.</p>
                            <input type="date" value={bulkExpireDate} onChange={e => setBulkExpireDate(e.target.value)} className="w-full bg-slate-900 border-2 border-indigo-500/50 rounded-xl p-4 text-white font-mono outline-none focus:border-indigo-500 mb-6"/>
                            <div className="flex gap-2">
                                <button onClick={() => setIsResetDateModalOpen(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition">Hủy</button>
                                <button onClick={handleBulkResetExpireDate} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition">Áp Dụng</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}