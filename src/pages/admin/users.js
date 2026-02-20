import { useState, useEffect } from 'react';
import { firestore, auth } from '@/lib/firebase'; 
import { onAuthStateChanged } from 'firebase/auth'; 
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { 
    Users, Search, Plus, Edit, Trash2, Save, X, 
    Calendar, CheckCircle, AlertTriangle, Clock, 
    GraduationCap, Briefcase, Shield, Star
} from 'lucide-react';

export default function AdminUserManagement() {
    const [allUsers, setAllUsers] = useState([]);
    const [activeTab, setActiveTab] = useState('TEACHER'); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState({
        id: '', name: '', email: '', role: 'teacher', expireDate: '', status: 'active', grade: ''
    });

    // 1. LẤY DỮ LIỆU ĐỘNG THEO TAB
    const fetchUsers = async () => {
        setLoading(true);
        setAllUsers([]); // Xóa list cũ trước khi tải list mới
        try {
            if (activeTab === 'TEACHER') {
                // Đọc từ bảng users cho Giáo viên
                const querySnapshot = await getDocs(collection(firestore, 'users'));
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllUsers(data.filter(u => u.role === 'teacher' || !u.role));
            } else {
                // Đọc từ bảng student_profiles cho Học sinh (GIỮ NGUYÊN CẤU TRÚC CŨ CỦA BẠN)
                const querySnapshot = await getDocs(collection(firestore, 'student_profiles'));
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllUsers(data);
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

    // 2. HÀM XÓA (Tự động biết xóa ở bảng nào)
 // 2. HÀM XÓA (Gọi API Backend để xóa tận gốc)
    const handleDelete = async (id) => {
        if (window.confirm("Bạn có chắc chắn muốn XÓA TẬN GỐC tài khoản này không? Toàn bộ dữ liệu đăng nhập và hồ sơ sẽ bốc hơi và không thể khôi phục!")) {
            setLoading(true);
            try {
                // Xác định xem đang xóa Giáo viên (bảng users) hay Học sinh (bảng student_profiles)
                const targetCollection = activeTab === 'TEACHER' ? 'users' : 'student_profiles';
                
                // Gọi API backend chúng ta vừa tạo
                const response = await fetch('/api/delete-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        uid: id, 
                        collectionName: targetCollection 
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Xóa thất bại");
                }

                alert("✅ Đã xóa tận gốc thành công!");
                fetchUsers(); // Tải lại danh sách
            } catch (error) {
                console.error(error);
                alert("Lỗi khi xóa: " + error.message);
            } finally {
                setLoading(false);
            }
        }
    };

    // 3. HÀM LƯU / CẬP NHẬT (Tự nhận diện trường dữ liệu)
    const handleSave = async () => {
        if (!currentUser.name) return alert("Vui lòng nhập tên!");
        setLoading(true);
        try {
            const targetCollection = activeTab === 'TEACHER' ? 'users' : 'student_profiles';
            const userRef = doc(firestore, targetCollection, currentUser.id);

            if (activeTab === 'TEACHER') {
                await updateDoc(userRef, {
                    name: currentUser.name,
                    expireDate: currentUser.expireDate || "",
                    status: 'active',
                    role: 'teacher'
                });
            } else {
                // Học sinh dùng trường fullName và nickname
                await updateDoc(userRef, {
                    fullName: currentUser.name,
                    nickname: currentUser.name, // Cập nhật luôn nickname
                    grade: currentUser.grade || "10"
                });
            }
            
            setIsModalOpen(false);
            fetchUsers();
            alert("Cập nhật thành công!");
        } catch (error) {
            alert("Lỗi khi lưu!");
        } finally {
            setLoading(false);
        }
    };

    // Hàm lọc tìm kiếm (hỗ trợ cả field name của GV và fullName của HS)
    const filteredUsers = allUsers.filter(user => {
        const nameToSearch = (user.name || user.fullName || "").toLowerCase();
        const emailToSearch = (user.email || "").toLowerCase();
        const phoneToSearch = (user.phone || "").toLowerCase();
        const term = searchTerm.toLowerCase();
        return nameToSearch.includes(term) || emailToSearch.includes(term) || phoneToSearch.includes(term);
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
                    {/* Search Bar */}
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition" size={20} />
                        <input 
                            type="text" placeholder="Tìm kiếm tên, email, sđt..."
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900/50 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 w-full md:w-80 outline-none focus:border-indigo-500/50 transition"
                        />
                    </div>
                </div>

                {/* TABS */}
                <div className="flex gap-2 mt-8 bg-slate-900/50 p-1.5 rounded-2xl w-fit border border-slate-800">
                    <button onClick={() => setActiveTab('TEACHER')} className={`px-6 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${activeTab === 'TEACHER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                        <Briefcase size={16}/> GIÁO VIÊN
                    </button>
                    <button onClick={() => setActiveTab('STUDENT')} className={`px-6 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${activeTab === 'STUDENT' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                        <GraduationCap size={16}/> HỌC SINH
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="max-w-7xl mx-auto bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-800">
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Người dùng</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">
                                {activeTab === 'TEACHER' ? 'Trạng thái & Thời hạn' : 'Thông tin Học tập'}
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-500">Đang kiểm tra bảo mật và tải dữ liệu...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-500">Không tìm thấy tài khoản nào</td></tr>
                        ) : filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-800/30 transition group">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-white flex items-center gap-2">
                                        {/* Avatar cho học sinh (nếu có) */}
                                        {activeTab === 'STUDENT' && user.photoURL && <img src={user.photoURL} className="w-6 h-6 rounded-full border border-slate-600"/>}
                                        {user.name || user.fullName || 'Chưa cập nhật'}
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono mt-1">{user.email || user.phone}</div>
                                </td>
                                
                                <td className="px-6 py-4">
                                    {activeTab === 'TEACHER' ? (
                                        // CỘT HIỂN THỊ CỦA GIÁO VIÊN
                                        <>
                                            {user.status === 'active' ? (
                                                <span className="text-emerald-400 text-[10px] font-black bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1 w-fit">
                                                    <CheckCircle size={10}/> ĐÃ KÍCH HOẠT
                                                </span>
                                            ) : (
                                                <span className="text-amber-400 text-[10px] font-black bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1 w-fit">
                                                    <Clock size={10}/> CHỜ GIA HẠN
                                                </span>
                                            )}
                                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                                <Calendar size={10}/> {user.expireDate || 'Vô thời hạn'}
                                            </div>
                                        </>
                                    ) : (
                                        // CỘT HIỂN THỊ CỦA HỌC SINH
                                        <>
                                            <span className="text-cyan-400 text-[10px] font-black bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20 flex items-center gap-1 w-fit mb-1">
                                                <CheckCircle size={10}/> TÀI KHOẢN ACTIVE
                                            </span>
                                            <div className="text-[11px] text-slate-400 font-bold uppercase flex items-center gap-2">
                                                <span>LỚP {user.grade || '10'}</span> 
                                                <span className="text-slate-600">|</span> 
                                                <span className="text-yellow-500 flex items-center gap-1"><Star size={10} fill="currentColor"/> {user.totalScore || 0} XP</span>
                                            </div>
                                        </>
                                    )}
                                </td>

                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => { 
                                                // Nạp dữ liệu vào form sửa (đồng nhất fullName/name)
                                                setCurrentUser({
                                                    ...user,
                                                    name: user.name || user.fullName || ''
                                                }); 
                                                setIsModalOpen(true); 
                                            }}
                                            className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(user.id)}
                                            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL SỬA THÔNG TIN */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Cập nhật tài khoản</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Tên hiển thị</label>
                                <input 
                                    value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 outline-none focus:border-indigo-500 text-white font-bold"
                                />
                            </div>
                            
                            {/* Phân loại Form nhập theo Giáo viên / Học sinh */}
                            {activeTab === 'TEACHER' ? (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block text-indigo-400">Ngày hết hạn (Gia hạn)</label>
                                    <input 
                                        type="date" value={currentUser.expireDate} onChange={e => setCurrentUser({...currentUser, expireDate: e.target.value})}
                                        className="w-full bg-slate-800 border border-indigo-500/30 rounded-xl p-3 outline-none focus:border-indigo-500 text-white font-mono"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block text-emerald-400">Khối Lớp</label>
                                    <select 
                                        value={currentUser.grade || '10'} onChange={e => setCurrentUser({...currentUser, grade: e.target.value})}
                                        className="w-full bg-slate-800 border border-emerald-500/30 rounded-xl p-3 outline-none focus:border-emerald-500 text-white font-bold"
                                    >
                                        {[6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Lớp {g}</option>)}
                                    </select>
                                </div>
                            )}

                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-800 rounded-xl transition">HỦY</button>
                            <button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2">
                                <Save size={16}/> LƯU LẠI
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}