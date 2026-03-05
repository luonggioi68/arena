import { useState, useEffect } from 'react';
import { firestore, auth } from '@/lib/firebase'; 
import { onAuthStateChanged } from 'firebase/auth'; 
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { 
    Users, Search, Plus, Edit, Trash2, Save, X, 
    Calendar, CheckCircle, AlertTriangle, Clock, 
    GraduationCap, Briefcase, Shield, Star, Lock, Unlock, Timer, RefreshCcw
} from 'lucide-react';

export default function AdminUserManagement() {
    const [allUsers, setAllUsers] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]); // Lưu cache để đối chiếu chéo
    const [allStudents, setAllStudents] = useState([]); // Lưu cache để đối chiếu chéo
    const [activeTab, setActiveTab] = useState('TEACHER'); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // State cho Modal Sửa đơn lẻ
    const [currentUser, setCurrentUser] = useState({
        id: '', name: '', email: '', role: 'teacher', expireDate: '', status: 'active', grade: ''
    });

    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isResetDateModalOpen, setIsResetDateModalOpen] = useState(false);
    const [bulkExpireDate, setBulkExpireDate] = useState('');

    const sortUsersByNewest = (usersList) => {
        return usersList.sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return timeB - timeA; 
        });
    };

    // 1. LẤY DỮ LIỆU CẢ 2 BÊN ĐỂ ĐỐI CHIẾU CHÉO & PHÁT HIỆN TRÙNG LẶP
    const fetchUsers = async () => {
        setLoading(true);
        setSelectedUsers([]);
        try {
            // Lấy cả 2 collection cùng lúc để kiểm tra chéo
            const tSnap = await getDocs(collection(firestore, 'users'));
            let tData = tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(u => u.role === 'teacher' || !u.role);
            
            const sSnap = await getDocs(collection(firestore, 'student_profiles'));
            let sData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            tData = sortUsersByNewest(tData);
            sData = sortUsersByNewest(sData);

            setAllTeachers(tData);
            setAllStudents(sData);

            if (activeTab === 'TEACHER') {
                setAllUsers(tData);
            } else {
                setAllUsers(sData);
            }
        } catch (error) {
            console.error("Lỗi lấy dữ liệu:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) fetchUsers();
            else setLoading(false);
        });
        return () => unsubscribe();
    }, [activeTab]);

    // --- LOGIC XỬ LÝ TRÙNG EMAIL TRƯỚC KHI HIỂN THỊ ---
    const emailMap = {};
    allUsers.forEach(u => {
        if (u.email) {
            if (!emailMap[u.email]) emailMap[u.email] = [];
            emailMap[u.email].push(u);
        }
    });

    const processedUsers = allUsers.map(u => {
        if (!u.email || !emailMap[u.email] || emailMap[u.email].length === 1) {
            return { ...u, isDuplicate: false, isOldDuplicate: false };
        }
        // Vì list đã sort mới nhất lên đầu, bản ghi đầu tiên là bản mới nhất
        const isOldDuplicate = emailMap[u.email][0].id !== u.id;
        return { ...u, isDuplicate: true, isOldDuplicate };
    });

    // Hàm lọc tìm kiếm 
    const filteredUsers = processedUsers.filter(user => {
        const nameToSearch = (user.name || user.fullName || "").toLowerCase();
        const emailToSearch = (user.email || "").toLowerCase();
        const phoneToSearch = (user.phone || "").toLowerCase();
        const term = searchTerm.toLowerCase();
        return nameToSearch.includes(term) || emailToSearch.includes(term) || phoneToSearch.includes(term);
    });

    // 2. HÀM XÓA THÔNG MINH (BẢO VỆ AUTH NẾU ĐANG CHÉO VAI TRÒ)
    const handleDelete = async (id) => {
        const targetUser = allUsers.find(u => u.id === id);
        const userEmail = targetUser?.email;
        
        // Kiểm tra xem email này có đang nằm ở collection bên kia không
        const existsInOther = userEmail && (
            activeTab === 'TEACHER' 
                ? allStudents.some(s => s.email === userEmail)
                : allTeachers.some(t => t.email === userEmail)
        );

        let confirmMsg = "Bạn có chắc chắn muốn XÓA TẬN GỐC tài khoản này không? Toàn bộ dữ liệu đăng nhập và hồ sơ sẽ bốc hơi và không thể khôi phục!";
        
        if (existsInOther) {
            confirmMsg = `⚠️ CHÚ Ý: Email này CŨNG ĐANG ĐĂNG KÝ ở mục ${activeTab === 'TEACHER' ? 'HỌC SINH' : 'GIÁO VIÊN'}.\nHành động này sẽ CHỈ XÓA hồ sơ hiện tại, và GIỮ LẠI tài khoản đăng nhập (Auth) để họ không bị mất quyền bên kia. Bạn đồng ý chứ?`;
        } else if (targetUser?.isOldDuplicate) {
            confirmMsg = "Bạn đang xóa một bản ghi bị trùng lặp cũ. Hành động này sẽ dọn dẹp dữ liệu rác mà không ảnh hưởng tài khoản gốc. Tiếp tục?";
        }

        if (window.confirm(confirmMsg)) {
            setLoading(true);
            try {
                const targetCollection = activeTab === 'TEACHER' ? 'users' : 'student_profiles';
                
                // Nếu User có 2 vai trò HOẶC đang là bản ghi rác trùng lặp -> Chỉ xóa doc trên client, không chọc vào API xóa Auth
                if (existsInOther || targetUser?.isOldDuplicate) {
                    try {
                        await deleteDoc(doc(firestore, targetCollection, id));
                        alert("✅ Đã xóa hồ sơ thành công (Tài khoản Auth gốc được giữ nguyên)!");
                        fetchUsers();
                        setLoading(false);
                        return; // Ngắt hàm, không chạy API bên dưới
                    } catch (err) {
                        console.warn("Chưa cấp quyền xóa client, chuyển qua API fallback...", err);
                    }
                }

                // Gọi API như cũ cho trường hợp xóa tận gốc
                const response = await fetch('/api/delete-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        uid: id, 
                        collectionName: targetCollection,
                        keepAuth: existsInOther || targetUser?.isOldDuplicate // Báo thêm cho API của bạn nếu API có hỗ trợ cờ này
                    })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Xóa thất bại");

                alert("✅ Đã xóa tận gốc thành công!");
                fetchUsers(); 
            } catch (error) {
                console.error(error);
                alert("Lỗi khi xóa: " + error.message);
            } finally {
                setLoading(false);
            }
        }
    };

    // --- HÀM MỚI: XÓA HÀNG LOẠT THÔNG MINH ---
    const handleBulkDelete = async () => {
        if (selectedUsers.length === 0) return;
        if (window.confirm(`⚠️ CHÚ Ý: Đang xóa ${selectedUsers.length} tài khoản.\nHệ thống sẽ tự động giữ lại tài khoản Auth gốc nếu họ có đăng ký ở vai trò khác hoặc là bản ghi trùng lặp cũ. Bạn chắc chắn chứ?`)) {
            setLoading(true);
            try {
                const targetCollection = activeTab === 'TEACHER' ? 'users' : 'student_profiles';
                
                const deletePromises = selectedUsers.map(async (uid) => {
                    const targetUser = allUsers.find(u => u.id === uid);
                    const userEmail = targetUser?.email;
                    
                    const existsInOther = userEmail && (
                        activeTab === 'TEACHER' 
                            ? allStudents.some(s => s.email === userEmail)
                            : allTeachers.some(t => t.email === userEmail)
                    );

                    // Xóa an toàn trên Firestore nếu là trùng lặp hoặc 2 vai trò
                    if (existsInOther || targetUser?.isOldDuplicate) {
                        try {
                            await deleteDoc(doc(firestore, targetCollection, uid));
                            return { success: true };
                        } catch (e) {
                            console.warn("Client delete failed, fallback to API");
                        }
                    }

                    // Gọi API cho những tài khoản cần xóa sạch
                    return fetch('/api/delete-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            uid: uid, 
                            collectionName: targetCollection,
                            keepAuth: existsInOther || targetUser?.isOldDuplicate
                        })
                    });
                });

                await Promise.all(deletePromises);

                alert(`✅ Đã xử lý xóa thành công ${selectedUsers.length} tài khoản!`);
                fetchUsers();
            } catch (error) {
                console.error(error);
                alert("Lỗi khi xóa hàng loạt: " + error.message);
            } finally {
                setLoading(false);
            }
        }
    };

    // Xử lý Checkbox & Reset Date giữ nguyên như cũ
    const handleSelectAll = (e, filteredList) => {
        if (e.target.checked) setSelectedUsers(filteredList.map(u => u.id));
        else setSelectedUsers([]);
    };

    const handleSelectOne = (id) => {
        if (selectedUsers.includes(id)) setSelectedUsers(selectedUsers.filter(userId => userId !== id));
        else setSelectedUsers([...selectedUsers, id]);
    };

    const handleBulkResetExpireDate = async () => {
        if (selectedUsers.length === 0 || !bulkExpireDate) return;
        setLoading(true);
        try {
            if (activeTab === 'TEACHER') {
                const updatePromises = selectedUsers.map(uid => updateDoc(doc(firestore, 'users', uid), { expireDate: bulkExpireDate }));
                await Promise.all(updatePromises);
                alert(`✅ Đã reset ngày hết hạn thành công!`);
                setIsResetDateModalOpen(false);
                setBulkExpireDate('');
                fetchUsers();
            } else {
                alert("Chỉ áp dụng cho Giáo viên!");
                setIsResetDateModalOpen(false);
            }
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleLock = async (id, currentStatus) => {
        const newStatus = currentStatus === 'locked' ? 'active' : 'locked';
        if (!window.confirm(currentStatus === 'locked' ? "MỞ KHÓA tài khoản?" : "KHÓA tài khoản?")) return;
        setLoading(true);
        try {
            const targetCollection = activeTab === 'TEACHER' ? 'users' : 'student_profiles';
            await updateDoc(doc(firestore, targetCollection, id), { status: newStatus });
            setAllUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
        } catch (error) {
            alert("Lỗi cập nhật: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentUser.name) return alert("Vui lòng nhập tên!");
        setLoading(true);
        try {
            const targetCollection = activeTab === 'TEACHER' ? 'users' : 'student_profiles';
            const userRef = doc(firestore, targetCollection, currentUser.id);

            if (activeTab === 'TEACHER') {
                await updateDoc(userRef, { name: currentUser.name, expireDate: currentUser.expireDate || "", status: currentUser.status || 'active', role: 'teacher' });
            } else {
                await updateDoc(userRef, { fullName: currentUser.name, nickname: currentUser.name, grade: currentUser.grade || "10", status: currentUser.status || 'active' });
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (error) {
            alert("Lỗi khi lưu!");
        } finally {
            setLoading(false);
        }
    };

    const totalAccounts = filteredUsers.length;
    let activeAccounts = 0;
    let expiredAccounts = 0;

    filteredUsers.forEach(user => {
        if (activeTab === 'TEACHER') {
            if (user.expireDate) {
                const exp = new Date(user.expireDate);
                exp.setHours(0,0,0,0);
                if (exp - new Date(new Date().setHours(0,0,0,0)) < 0) expiredAccounts++;
                else activeAccounts++;
            } else activeAccounts++; 
        }
    });

    return (
        <div className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-200">
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-500/20 p-3 rounded-2xl"><Shield className="text-indigo-400" size={32} /></div>
                        <div>
                            <h1 className="text-2xl font-black text-white">QUẢN LÝ TÀI KHOẢN</h1>
                            <p className="text-slate-400 text-sm">Hệ thống kích hoạt chuyên gia & học sinh</p>
                        </div>
                    </div>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition" size={20} />
                        <input type="text" placeholder="Tìm kiếm tên, email, sđt..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-900/50 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 w-full md:w-80 outline-none focus:border-indigo-500/50 transition"/>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mt-8 mb-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl w-fit border border-slate-800">
                            <button onClick={() => setActiveTab('TEACHER')} className={`px-6 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${activeTab === 'TEACHER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><Briefcase size={16}/> GIÁO VIÊN</button>
                            <button onClick={() => setActiveTab('STUDENT')} className={`px-6 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${activeTab === 'STUDENT' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><GraduationCap size={16}/> HỌC SINH</button>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <div className="bg-slate-900/50 border border-slate-800 px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm">
                                <span className="text-slate-400 text-xs font-bold uppercase">Tổng TK:</span>
                                <span className="text-white font-black text-sm">{totalAccounts}</span>
                            </div>
                            {activeTab === 'TEACHER' && (
                                <>
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm"><span className="text-emerald-400 text-xs font-bold uppercase">TK Còn hạn:</span><span className="text-emerald-300 font-black text-sm">{activeAccounts}</span></div>
                                    <div className="bg-red-500/10 border border-red-500/20 px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm"><span className="text-red-400 text-xs font-bold uppercase">TK Hết hạn:</span><span className="text-red-300 font-black text-sm">{expiredAccounts}</span></div>
                                </>
                            )}
                        </div>
                    </div>

                    {selectedUsers.length > 0 && (
                        <div className="flex gap-2 animate-in fade-in zoom-in slide-in-from-bottom-4">
                            <button onClick={handleBulkDelete} className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white px-6 py-3 rounded-xl font-bold text-xs border border-red-600 shadow-lg transition-all flex items-center gap-2 uppercase tracking-widest"><Trash2 size={16}/> XÓA ({selectedUsers.length})</button>
                            {activeTab === 'TEACHER' && <button onClick={() => setIsResetDateModalOpen(true)} className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-6 py-3 rounded-xl font-bold text-xs border border-indigo-600 shadow-lg transition-all flex items-center gap-2 uppercase tracking-widest"><RefreshCcw size={16}/> RESET NGÀY HẾT HẠN</button>}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-900/50 border-b border-slate-800">
                                <th className="px-6 py-4 w-12 text-center border-r border-slate-800/50"><input type="checkbox" onChange={(e) => handleSelectAll(e, filteredUsers)} checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length} className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer accent-indigo-600"/></th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase w-16 text-center">TT</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Người dùng</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-center">Ngày đăng ký</th>
                                {activeTab === 'TEACHER' && <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-center">Thời gian còn lại</th>}
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{activeTab === 'TEACHER' ? 'Trạng thái & Thời hạn' : 'Thông tin Học tập'}</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-center w-28">Khóa TK</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                <tr><td colSpan={activeTab === 'TEACHER' ? 8 : 7} className="px-6 py-12 text-center text-slate-500">Đang tải và sắp xếp dữ liệu...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={activeTab === 'TEACHER' ? 8 : 7} className="px-6 py-12 text-center text-slate-500">Không tìm thấy tài khoản nào</td></tr>
                            ) : filteredUsers.map((user, index) => {
                                
                                const isSelected = selectedUsers.includes(user.id);
                                let isExpired = false, remainingDays = null;

                                if (activeTab === 'TEACHER' && user.expireDate) {
                                    const exp = new Date(user.expireDate);
                                    exp.setHours(0,0,0,0);
                                    const diffTime = exp - new Date(new Date().setHours(0,0,0,0));
                                    remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    isExpired = remainingDays < 0;
                                }

                                const isLocked = user.status === 'locked';
                                let regDate = '---';
                                if (user.createdAt) regDate = new Date(user.createdAt.seconds ? user.createdAt.seconds * 1000 : user.createdAt).toLocaleDateString('vi-VN');

                                return (
                                    <tr key={user.id} className={`transition group ${isLocked ? 'opacity-60 grayscale-[50%]' : ''} ${isSelected ? 'bg-indigo-900/30' : 'hover:bg-slate-800/30'}`}>
                                        <td className="px-6 py-4 text-center border-r border-slate-800/50"><input type="checkbox" onChange={() => handleSelectOne(user.id)} checked={isSelected} className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer accent-indigo-500 transition-all hover:scale-110"/></td>
                                        <td className="px-6 py-4 text-center text-slate-500 font-mono font-bold text-sm">{index + 1}</td>
                                        
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white flex items-center gap-2">
                                                {activeTab === 'STUDENT' && user.photoURL && <img src={user.photoURL} className="w-6 h-6 rounded-full border border-slate-600"/>}
                                                {user.name || user.fullName || 'Chưa cập nhật'}
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2 flex-wrap">
                                                {user.email || user.phone}
                                                {/* Hiển thị Tag cảnh báo nếu email bị trùng */}
                                                {user.isDuplicate && (
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest ${user.isOldDuplicate ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`} title={user.isOldDuplicate ? 'Bản ghi cũ rác, bạn nên xóa nó đi' : 'Bản ghi này đang có một bản sao khác cũ hơn trong hệ thống'}>
                                                        {user.isOldDuplicate ? 'TRÙNG LẶP (CŨ)' : 'TRÙNG EMAIL'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center"><span className="text-xs text-slate-400 font-mono bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50 inline-block">{regDate}</span></td>
                                        
                                        {activeTab === 'TEACHER' && (
                                            <td className="px-6 py-4 text-center">
                                                {user.status !== 'active' && !isLocked ? <span className="text-slate-500 text-xs italic">Chưa kích hoạt</span> : remainingDays !== null ? ( remainingDays > 0 ? <span className="text-emerald-400 font-bold text-xs bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 flex items-center justify-center gap-1 w-fit mx-auto"><Timer size={12}/> Còn {remainingDays} ngày</span> : remainingDays === 0 ? <span className="text-orange-400 font-bold text-xs bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20 flex items-center justify-center gap-1 w-fit mx-auto animate-pulse"><Timer size={12}/> Hết hạn hôm nay</span> : <span className="text-red-400 font-bold text-xs bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 flex items-center justify-center gap-1 w-fit mx-auto"><AlertTriangle size={12}/> Quá hạn {Math.abs(remainingDays)} ngày</span>) : <span className="text-slate-500 text-xs italic">Vô thời hạn</span>}
                                            </td>
                                        )}

                                        <td className="px-6 py-4">
                                            {isLocked ? (
                                                <span className="text-red-500 text-[10px] font-black bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 flex items-center gap-1 w-fit"><Lock size={10}/> ĐÃ BỊ KHÓA</span>
                                            ) : activeTab === 'TEACHER' ? (
                                                <>
                                                    {user.status !== 'active' ? <span className="text-amber-400 text-[10px] font-black bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1 w-fit"><Clock size={10}/> CHỜ GIA HẠN</span> : isExpired ? <span className="text-red-400 text-[10px] font-black bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 flex items-center gap-1 w-fit animate-pulse shadow-[0_0_10px_rgba(248,113,113,0.2)]"><AlertTriangle size={10}/> ĐÃ HẾT HẠN</span> : <span className="text-emerald-400 text-[10px] font-black bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1 w-fit"><CheckCircle size={10}/> ĐÃ KÍCH HOẠT</span>}
                                                    <div className={`text-[10px] mt-1 flex items-center gap-1 ${isExpired ? 'text-red-400 font-bold' : 'text-slate-500'}`}><Calendar size={10}/> {user.expireDate || 'Vô thời hạn'}</div>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-cyan-400 text-[10px] font-black bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20 flex items-center gap-1 w-fit mb-1"><CheckCircle size={10}/> TÀI KHOẢN ACTIVE</span>
                                                    <div className="text-[11px] text-slate-400 font-bold uppercase flex items-center gap-2"><span>LỚP {user.grade || '10'}</span> <span className="text-slate-600">|</span> <span className="text-yellow-500 flex items-center gap-1"><Star size={10} fill="currentColor"/> {user.totalScore || 0} XP</span></div>
                                                </>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-center"><button onClick={() => handleToggleLock(user.id, user.status)} className={`p-2 rounded-xl border transition-all ${isLocked ? 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20'}`}>{isLocked ? <Lock size={16} /> : <Unlock size={16} />}</button></td>

                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setCurrentUser({...user, name: user.name || user.fullName || ''}); setIsModalOpen(true); }} className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition" title="Chỉnh sửa / Gia hạn"><Edit size={18} /></button>
                                                <button onClick={() => handleDelete(user.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition" title="Xóa vĩnh viễn"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Các modal giữ nguyên không đổi */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-white uppercase tracking-tighter">Cập nhật tài khoản</h2><button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button></div>
                        <div className="space-y-4">
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block tracking-widest">Tên hiển thị</label><input value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 outline-none focus:border-indigo-500 text-white font-bold transition-colors"/></div>
                            {activeTab === 'TEACHER' ? (
                                <div><label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><Calendar size={12}/> Ngày hết hạn</label><input type="date" value={currentUser.expireDate} onChange={e => setCurrentUser({...currentUser, expireDate: e.target.value})} className="w-full bg-slate-800 border border-indigo-500/30 rounded-xl p-3 outline-none focus:border-indigo-500 text-white font-mono transition-colors"/><p className="text-[10px] text-slate-500 mt-1 italic">* Chọn ngày giới hạn tài khoản, hoặc để trống nếu vô thời hạn.</p></div>
                            ) : (
                                <div><label className="text-[10px] font-bold text-emerald-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><GraduationCap size={12}/> Khối Lớp</label><select value={currentUser.grade || '10'} onChange={e => setCurrentUser({...currentUser, grade: e.target.value})} className="w-full bg-slate-800 border border-emerald-500/30 rounded-xl p-3 outline-none focus:border-emerald-500 text-white font-bold transition-colors">{[6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Lớp {g}</option>)}</select></div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-8"><button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-800 hover:text-white rounded-xl transition-colors">HỦY BỎ</button><button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"><Save size={16}/> LƯU LẠI</button></div>
                    </div>
                </div>
            )}

            {isResetDateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-white uppercase tracking-tighter">Reset Hàng Loạt</h2><button onClick={() => setIsResetDateModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button></div>
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl mb-4"><p className="text-sm text-indigo-300 font-bold mb-1">Đang chọn: <span className="text-white text-lg">{selectedUsers.length}</span> tài khoản</p><p className="text-[10px] text-slate-400 italic">Tất cả tài khoản được chọn sẽ cập nhật chung về ngày hết hạn bên dưới.</p></div>
                        <div className="space-y-4"><div><label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><Calendar size={12}/> Ngày hết hạn mới</label><input type="date" value={bulkExpireDate} onChange={e => setBulkExpireDate(e.target.value)} className="w-full bg-slate-800 border border-indigo-500/30 rounded-xl p-4 outline-none focus:border-indigo-500 text-white font-mono transition-colors text-lg"/></div></div>
                        <div className="flex gap-3 mt-8"><button onClick={() => setIsResetDateModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-800 hover:text-white rounded-xl transition-colors">HỦY BỎ</button><button onClick={handleBulkResetExpireDate} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"><RefreshCcw size={16}/> ÁP DỤNG NGAY</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}