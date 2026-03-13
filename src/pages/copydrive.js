import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { AlertTriangle, Home, Flame } from 'lucide-react';

const MASTER_EMAILS = ["luonggioi68@gmail.com"]; // Quyền Admin gốc

export default function CopyDrivePage() {
  const router = useRouter();
  
  // STATE KIỂM TRA QUYỀN BẢO MẬT
  const [isTeacher, setIsTeacher] = useState(null); 

  // LOGIC PHÂN QUYỀN: BẮT BUỘC KIỂM TRA ROLE TEACHER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocSnap = await getDoc(doc(firestore, "users", currentUser.uid));
        const userData = userDocSnap.exists() ? userDocSnap.data() : {};
        const checkRole = userData.role === 'teacher' || MASTER_EMAILS.includes(currentUser.email);
        
        setIsTeacher(checkRole);
      } else {
        setIsTeacher(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // LOGIC HIỂN THỊ CÔNG CỤ COPY DRIVE GỐC (CHỈ CHẠY KHI LÀ GIÁO VIÊN)
  useEffect(() => {
    // Nếu chưa check xong hoặc không phải giáo viên -> Không làm gì cả
    if (isTeacher !== true) return;

    const scriptUrl = "https://script.google.com/macros/s/AKfycbwiPMTvMUFduxGZsbeSh_Gp_g8AqFQmcX8QsY21yPk63ikwl0UkR7LMq5ZPM2Akbxs/exec";

    const container = document.createElement('div');
    container.id = "drive-wrapper";
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        overflow: hidden;
        background: #000; /* Màu nền đen khớp với ứng dụng */
        z-index: 9999;
    `;

    const iframe = document.createElement('iframe');
    iframe.src = scriptUrl;
    iframe.style.cssText = `
        position: absolute;
        /* GIẢI PHÁP: Đẩy lên vừa đủ che thanh thông báo, không đẩy quá sâu */
        top: -15px; 
        left: 0;
        width: 100%;
        /* Tăng nhẹ chiều cao để bù đắp phần bị đẩy lên */
        height: calc(100% + 38px); 
        border: none;
        /* Thêm hiệu ứng mượt mà */
        filter: brightness(1.1); 
    `;

    container.appendChild(iframe);
    document.body.appendChild(container);

    // Xử lý cuộn trang để tránh bị lệch trên mobile
    document.body.style.overflow = "hidden";

    return () => {
      const el = document.getElementById("drive-wrapper");
      if (el) el.remove();
      document.body.style.overflow = "auto";
    };
  }, [isTeacher]); // Chỉ chạy khi state isTeacher thay đổi thành true

  // 1. MÀN HÌNH CHỜ KIỂM TRA QUYỀN
  if (isTeacher === null) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-bold shadow-[0_0_20px_rgba(249,115,22,0.5)]">
              <Flame className="animate-bounce mr-2" size={30} /> ĐANG QUÉT PHÂN QUYỀN CHIẾN BINH...
          </div>
      );
  }

  // 2. MÀN HÌNH TỪ CHỐI TRUY CẬP CHO HỌC SINH/KHÁCH
  if (isTeacher === false) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center flex-col text-center p-4 relative overflow-hidden selection:bg-red-500 selection:text-white">
          <Head><title>Khu Vực Hạn Chế | Arena Edu</title></Head>
          <div className="absolute top-40 left-10 w-72 h-72 bg-red-600/20 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-40 right-10 w-96 h-96 bg-orange-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          <AlertTriangle className="w-20 h-20 md:w-[100px] md:h-[100px] text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse relative z-10"/>
          <h1 className="text-2xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 mb-4 uppercase tracking-widest relative z-10">Khu Vực Hạn Chế</h1>
          <p className="text-slate-400 mb-10 font-bold tracking-widest text-xs md:text-sm relative z-10 px-4 max-w-lg">Công cụ Sao Chép Drive là vũ khí tuyệt mật. Bạn cần đăng nhập bằng tài khoản <span className="text-red-400 font-black">GIÁO VIÊN</span> để sử dụng.</p>
          <button onClick={() => router.push('/')} className="relative z-10 bg-slate-900/80 hover:bg-cyan-600 text-cyan-400 hover:text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-black transition-all border border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-3 uppercase tracking-widest hover:scale-105 active:scale-95 text-xs md:text-base"><Home size={20}/> Trở Về Căn Cứ</button>
        </div>
      );
  }

  // 3. NẾU LÀ GIÁO VIÊN -> TRẢ VỀ NULL ĐỂ ĐỂ CHO USE-EFFECT BÊN TRÊN RENDER IFRAME GỐC
  return null;
}