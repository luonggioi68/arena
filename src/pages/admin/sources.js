// pages/admin/sources.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Shield, Plus, Trash2, ArrowLeft, Link as LinkIcon, Database, Loader2 } from 'lucide-react';

const MASTER_EMAILS = ["luonggioi68@gmail.com"];
const GRADES = ["12", "11", "10", "9", "8", "7", "6"];
const SUBJECTS = ["Tin học", "Toán học", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "GDCD", "Công nghệ"];

export default function SourceManager() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sources, setSources] = useState([]);
    
    // Form state
    const [formData, setFormData] = useState({
        title: '', grade: '12', subject: 'Tin học', textbook: 'Kết nối tri thức', docLink: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser || !MASTER_EMAILS.includes(currentUser.email)) {
                router.push('/'); // Đẩy ra ngoài nếu không phải Admin
                return;
            }
            setUser(currentUser);
            fetchSources();
        });
        return () => unsubscribe();
    }, [router]);

    const fetchSources = async () => {
        try {
            const q = query(collection(firestore, "exam_sources"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            setSources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        } catch (error) {
            console.error("Lỗi tải nguồn:", error);
            setLoading(false);
        }
    };

    const handleAddSource = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.docLink) return alert("Vui lòng nhập Tên nguồn và Link Google Doc!");
        
        setIsSubmitting(true);
        try {
            const docRef = await addDoc(collection(firestore, "exam_sources"), {
                ...formData,
                createdAt: serverTimestamp()
            });
            setSources([{ id: docRef.id, ...formData }, ...sources]);
            setFormData({ ...formData, title: '', docLink: '' });
            alert("✅ Đã thêm nguồn thành công!");
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Bạn có chắc chắn muốn xóa nguồn này?")) return;
        try {
            await deleteDoc(doc(firestore, "exam_sources", id));
            setSources(sources.filter(s => s.id !== id));
        } catch (error) {
            alert("Lỗi xóa: " + error.message);
        }
    };

    if (loading) return <div className="min-h-screen bg-black flex justify-center items-center text-orange-500"><Loader2 className="animate-spin" size={40}/></div>;

    return (
        <div className="min-h-screen bg-[#050505] text-gray-200 p-6 md:p-12">
            <header className="max-w-6xl mx-auto flex justify-between items-center mb-10 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 bg-gray-900 border border-orange-500/30 rounded-xl hover:bg-orange-600/20 text-orange-400 transition-all"><ArrowLeft size={20}/></button>
                    <div>
                        <h1 className="text-3xl font-black uppercase italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 flex items-center gap-3">
                            <Shield size={30} className="text-orange-500"/> QUẢN TRỊ NGUỒN TÀI LIỆU
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Chỉ dành cho Admin hệ thống</p>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* CỘT TRÁI: FORM THÊM NGUỒN */}
                <div className="bg-gray-900/80 p-6 rounded-2xl border border-orange-500/30 shadow-xl h-fit">
                    <h2 className="text-xl font-black uppercase text-white mb-6 flex items-center gap-2"><Database size={20} className="text-orange-500"/> Thêm Nguồn Mới</h2>
                    <form onSubmit={handleAddSource} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Tên Nguồn / Tiêu đề</label>
                            <input value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} className="w-full bg-black border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-orange-500" placeholder="VD: Đề cương Giữa kì 2..."/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Khối Lớp</label>
                                <select value={formData.grade} onChange={e=>setFormData({...formData, grade: e.target.value})} className="w-full bg-black border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-orange-500">
                                    {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Môn Học</label>
                                <select value={formData.subject} onChange={e=>setFormData({...formData, subject: e.target.value})} className="w-full bg-black border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-orange-500">
                                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Sách Giáo Khoa</label>
                            <select value={formData.textbook} onChange={e=>setFormData({...formData, textbook: e.target.value})} className="w-full bg-black border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-orange-500">
                                <option value="Kết nối tri thức">Kết nối tri thức</option>
                                <option value="Chân trời sáng tạo">Chân trời sáng tạo</option>
                                <option value="Cánh diều">Cánh diều</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Link Google Doc (Share Public)</label>
                            <input value={formData.docLink} onChange={e=>setFormData({...formData, docLink: e.target.value})} className="w-full bg-black border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-orange-500" placeholder="https://docs.google.com/..."/>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white p-3 rounded-xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex justify-center items-center gap-2 mt-4">
                            {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Plus size={20}/>} Lưu Nguồn
                        </button>
                    </form>
                </div>

                {/* CỘT PHẢI: DANH SÁCH NGUỒN */}
                <div className="lg:col-span-2 bg-gray-900/80 p-6 rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                    <h2 className="text-xl font-black uppercase text-white mb-6">Danh sách Nguồn đã lưu</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black text-slate-400 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4 rounded-tl-xl">TT</th>
                                    <th className="p-4">Thông tin</th>
                                    <th className="p-4">Nguồn</th>
                                    <th className="p-4 text-center rounded-tr-xl">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {sources.map((s, i) => (
                                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-mono text-slate-500">{i + 1}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-white text-base">{s.title}</div>
                                            <div className="text-xs text-orange-400 font-bold mt-1">{s.subject} - Lớp {s.grade} ({s.textbook})</div>
                                        </td>
                                        <td className="p-4">
                                            <a href={s.docLink} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-xs bg-blue-900/20 w-fit px-3 py-1.5 rounded-lg border border-blue-500/30"><LinkIcon size={12}/> Mở Doc</a>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:bg-red-500/20 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                        </td>
                                    </tr>
                                ))}
                                {sources.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">Chưa có dữ liệu nguồn nào.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}