import { useState, useEffect } from 'react';
import { AlertTriangle, X, Clock } from 'lucide-react';
import { auth, firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ExpiryAlert() {
    const [daysLeft, setDaysLeft] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkExpiry = async () => {
            // 1. Chờ Firebase Auth khởi tạo
            const user = auth.currentUser;
            if (!user || !user.email) return;

            try {
                // 2. Tìm trong bảng 'allowed_emails' xem giáo viên này có hạn dùng không
                const q = query(
                    collection(firestore, "allowed_emails"), 
                    where("email", "==", user.email)
                );
                
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data();
                    
                    // Kiểm tra trường 'expiredAt' (khớp với dashboard.js và users.js)
                    if (data.expiredAt) {
                        const expireDate = new Date(data.expiredAt.seconds * 1000);
                        const today = new Date();
                        
                        // Tính số ngày còn lại (làm tròn lên)
                        const diffTime = expireDate - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        // LOGIC HIỂN THỊ:
                        // - Nếu đã hết hạn (diffDays < 0) -> Luôn hiện
                        // - Nếu còn <= 2 ngày -> Hiện cảnh báo
                        if (diffDays <= 2) {
                            setDaysLeft(diffDays);
                            setIsVisible(true);
                        }
                    }
                }
            } catch (e) {
                console.error("Lỗi kiểm tra hạn:", e);
            } finally {
                setLoading(false);
            }
        };

        // Lắng nghe thay đổi auth để chạy check
        const unsubscribe = auth.onAuthStateChanged(() => {
            checkExpiry();
        });

        return () => unsubscribe();
    }, []);

    if (!isVisible) return null;

    // Màu sắc cảnh báo: Đỏ nếu hết hạn hoặc còn 0 ngày, Vàng nếu còn 1-2 ngày
    const isCritical = daysLeft <= 0;

    return (
        <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom duration-700">
            <div className={`relative p-5 rounded-2xl shadow-2xl border-4 flex items-start gap-4 max-w-sm overflow-hidden backdrop-blur-md ${isCritical ? 'bg-red-900/90 border-red-500 text-white' : 'bg-yellow-500/90 border-yellow-300 text-black'}`}>
                
                {/* Icon động */}
                <div className={`p-3 rounded-full shadow-inner ${isCritical ? 'bg-red-800 animate-pulse' : 'bg-yellow-600/20'}`}>
                    {isCritical ? <AlertTriangle size={32} /> : <Clock size={32} className="animate-bounce" />}
                </div>

                <div className="flex-1">
                    <h4 className="font-black uppercase text-lg leading-none mb-2 tracking-tighter">
                        {isCritical ? "TÀI KHOẢN SẮP KHÓA!" : "CẢNH BÁO GIA HẠN"}
                    </h4>
                    <p className="font-bold text-sm leading-snug opacity-90">
                        Thời hạn sử dụng còn lại:
                    </p>
                    <div className={`text-3xl font-black mt-1 ${isCritical ? 'text-red-200' : 'text-red-700'}`}>
                        {daysLeft < 0 ? "ĐÃ HẾT HẠN" : daysLeft === 0 ? "HẾT HÔM NAY" : `${daysLeft} NGÀY`}
                    </div>
                    <p className="text-[10px] mt-2 font-bold uppercase tracking-widest opacity-70">
                        Vui lòng liên hệ Admin phone/zalo: 0383477162
                    </p>
                </div>

                <button 
                    onClick={() => setIsVisible(false)}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition"
                >
                    <X size={16} />
                </button>
                
                {/* Hiệu ứng nền */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/20 rounded-full blur-2xl pointer-events-none"></div>
            </div>
        </div>
    );
}