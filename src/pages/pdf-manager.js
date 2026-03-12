import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '@/store/useAuthStore';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { 
    ArrowLeft, Plus, X, Loader2, Save, Trash2, Edit, Clock, FileText,
    FileCheck, FileDigit, UploadCloud, CheckCircle, Shield, BookOpen, GraduationCap, FileSpreadsheet, ListChecks, Users, Key, Filter, Target, Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';

const GRADES = ['1', '2', '3', '4', '5','6', '7', '8', '9', '10', '11', '12', 'Khác'];
const SUBJECTS = [
    { id: 'Toán học', name: 'Toán Học' }, { id: 'Ngữ văn', name: 'Ngữ Văn' },
    { id: 'Tiếng Anh', name: 'Tiếng Anh' }, { id: 'Tin học', name: 'Tin Học' },
    { id: 'Vật lí', name: 'Vật Lý' }, { id: 'Hóa học', name: 'Hóa Học' },
    { id: 'Sinh học', name: 'Sinh Học' }, { id: 'Lịch sử', name: 'Lịch Sử' },
    { id: 'Địa lí', name: 'Địa Lý' }, { id: 'Giáo dục công dân', name: 'GDCD' },
    { id: 'Khác', name: 'Khác' }
];

// Hàm chuyển đổi UID thành mã đúng 6 số cố định
const generateNumericCode = (uid) => {
    if (!uid) return '---';
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = (hash << 5) - hash + uid.charCodeAt(i);
        hash |= 0; // Chuyển thành số nguyên 32bit
    }
    // Lấy trị tuyệt đối, chia lấy dư cho 1.000.000 và thêm số 0 ở đầu nếu cần
    return Math.abs(hash % 1000000).toString().padStart(6, '0');
};

export default function PDFManager() {
    const router = useRouter();
    const { user, setUser } = useAuthStore();
    const [loading, setLoading] = useState(true);

    const [userConfig, setUserConfig] = useState({});
    const [pdfExams, setPdfExams] = useState([]);
    
    const [showPdfForm, setShowPdfForm] = useState(false);
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const [editingExamId, setEditingExamId] = useState(null); 
    
    // Áp dụng hàm tạo mã 6 số thay cho hàm cắt chuỗi cũ
    const myTeacherCode = generateNumericCode(user?.uid);

    const [studentResults, setStudentResults] = useState([]);
    const [filterGrade, setFilterGrade] = useState('Tất cả');
    const [filterSubject, setFilterSubject] = useState('Tất cả');
    
    const [availableClasses, setAvailableClasses] = useState([]);
    const [filterClassName, setFilterClassName] = useState('Tất cả');
    const [selectedRows, setSelectedRows] = useState([]);
    const [isDeletingStudents, setIsDeletingStudents] = useState(false);

    // State lọc danh sách Đề Thi
    const [examFilterGrade, setExamFilterGrade] = useState('Tất cả');
    const [examFilterSubject, setExamFilterSubject] = useState('Tất cả');
    const [isSystemFilter, setIsSystemFilter] = useState(false);

    // State quản lý Modal Xem chi tiết bài làm
    const [selectedAttempt, setSelectedAttempt] = useState(null);
    const [isFetchingAttempt, setIsFetchingAttempt] = useState(false);

    const [pdfFormData, setPdfFormData] = useState({
        format: '2025', title: '', timeLimit: 45, pdfUrl: '', grade: '12', subject: 'Toán học',
        allowedClasses: '', showAnswers: false, answersP1: '', answersP2: '', answersP3: ''    
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) { router.push('/'); return; }
            setUser(currentUser);
            try {
                const configSnap = await getDoc(doc(firestore, "user_configs", currentUser.uid));
                if (configSnap.exists()) setUserConfig(configSnap.data());
                
                // Mặc định lúc vào chỉ tải đề của bản thân để giảm tải trang
                await fetchPdfExams(currentUser.uid, currentUser.email);
                
                // Đồng bộ mã 6 số vào hàm fetch
                await fetchStudentResults(currentUser.uid, generateNumericCode(currentUser.uid));

            } catch (e) { console.error(e); } finally { setLoading(false); }
        });
        return () => unsubscribe();
    }, [router, setUser]);

    const fetchPdfExams = async (userId, userEmail, grade = 'Tất cả', subject = 'Tất cả', systemWide = false) => {
        try {
            const isAdmin = userEmail === 'luonggioi68@gmail.com';
            let qConstraints = [];

            if (!isAdmin || !systemWide) {
                qConstraints.push(where("authorId", "==", userId));
            } else {
                if (grade !== 'Tất cả') {
                    qConstraints.push(where("grade", "==", grade));
                }
            }

            const q = query(collection(firestore, "pdf_exams"), ...qConstraints);
            const s = await getDocs(q);
            let list = s.docs.map(d => ({ id: d.id, ...d.data() }));

            if (grade !== 'Tất cả' && (!isAdmin || !systemWide)) {
                 list = list.filter(exam => exam.grade === grade);
            }
            if (subject !== 'Tất cả') {
                 list = list.filter(exam => exam.subject === subject);
            }

            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setPdfExams(list);
            setIsSystemFilter(systemWide); 
        } catch (e) { console.error(e); }
    };

    const fetchStudentResults = async (userId, tCode) => {
        try {
            const q1 = query(collection(firestore, "pdf_exam_results"), where("teacherId", "==", userId));
            const snap1 = await getDocs(q1);
            
            const q2 = query(collection(firestore, "pdf_exam_results"), where("teacherCode", "==", tCode));
            const snap2 = await getDocs(q2);

            const uniqueMap = new Map();
            [...snap1.docs, ...snap2.docs].forEach(d => uniqueMap.set(d.id, { ...d.data(), docId: d.id }));

            const sortedDocs = Array.from(uniqueMap.values()).sort((a, b) => {
                const timeA = a.submittedAt?.seconds || 0;
                const timeB = b.submittedAt?.seconds || 0;
                return timeA - timeB;
            });

            const stats = {};
           sortedDocs.forEach((data) => {
                if (!data.studentName || data.studentName.includes('Khách_')) return;
                if (data.teacherCode !== undefined && data.teacherCode !== tCode) return;

                const grade = data.grade || 'Khác';
                const subject = data.subject || 'Khác';
                const sClass = data.studentClassName || 'Chưa phân lớp';
                
                const key = `${data.studentName}_${grade}_${sClass}_${subject}`;
                const score = parseFloat(data.score) || 0;

                if (!stats[key]) {
                    stats[key] = {
                        key: key,
                        name: data.studentName, className: sClass, grade: grade, subject: subject,
                        scores: [], docIds: [], attempts: [] 
                    };
                }
                
                stats[key].docIds.push(data.docId);
                stats[key].scores.push(score);
                stats[key].attempts.push({
                    docId: data.docId,
                    score: score,
                    answers: data.answers || { part1: {}, part2: {}, part3: {} },
                    examId: data.examId,
                    examTitle: data.examTitle
                });
            });

            const resultsArray = Object.values(stats).sort((a,b) => Math.max(...b.scores) - Math.max(...a.scores));
            setStudentResults(resultsArray);

            const classes = [...new Set(resultsArray.map(s => s.className))].sort();
            setAvailableClasses(classes);

        } catch (e) { console.error(e); }
    };

    const handlePdfUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') return alert('⚠️ Vui lòng tải lên file định dạng .PDF!');

        setIsUploadingPdf(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", 'gameedu'); 

        try {
            const cloudName = 'dcnsjzq0i'; 
            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.secure_url) {
                let finalUrl = data.secure_url;
                if (!finalUrl.toLowerCase().endsWith('.pdf')) finalUrl += '.pdf';
                setPdfFormData(prev => ({ ...prev, pdfUrl: finalUrl }));
            } else { alert("Lỗi Cloudinary: " + (data.error?.message || "Không xác định")); }
        } catch (err) { alert("Lỗi mạng: " + err.message); } 
        finally { 
            setIsUploadingPdf(false); 
            e.target.value = ''; 
        }
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                let p1 = "", p2 = "", p3 = "";
                let q1 = 1, q2 = 1, q3 = 1;

                for (let i = 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row || row.length < 2) continue;

                    let ansCell = row[1]; 
                    if (ansCell === undefined || ansCell === null || String(ansCell).trim() === '') {
                        for (let col = 2; col < row.length; col++) {
                            if (row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
                                ansCell = row[col]; break;
                            }
                        }
                    }

                    if (ansCell === undefined || ansCell === null) continue;
                    let val = String(ansCell).trim().toUpperCase();

                    if (/^[ABCD]$/.test(val)) { p1 += `${q1}${val} `; q1++; } 
                    else if (/^[ĐDS\s,;-]{4,}$/i.test(val) || (val.length >= 4 && /^[ĐDS]+$/i.test(val.replace(/[^ĐDS]/gi, '')))) {
                        const clean = val.replace(/[^ĐDS]/gi, '').replace(/D/g, 'Đ');
                        if (clean.length === 4) { p2 += `${q2}: ${clean}\n`; q2++; }
                    } else if (val !== '') { p3 += `${q3}: ${String(ansCell).trim()}\n`; q3++; }
                }

                setPdfFormData(prev => ({ ...prev, answersP1: p1.trim(), answersP2: p2.trim(), answersP3: p3.trim() }));
                alert(`✅ Đã trích xuất thành công: \n- ${q1-1} câu MCQ\n- ${q2-1} câu Đúng/Sai\n- ${q3-1} câu Trả lời ngắn.`);
            } catch (err) { alert('Lỗi khi đọc file Excel: ' + err.message); }
        };
        e.target.value = ''; 
        reader.readAsBinaryString(file);
    };

    const downloadSampleExcel = () => {
        const sampleData = [
            ["Câu hỏi/Mã đề", "401"], ["1", "D"], ["2", "D"], ["3", "C"],
            ["13", "SĐĐĐ"], ["14", "SĐSĐ"], ["17", "-4"], ["18", "4"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, "Mau_Dap_An_Arena.xlsx");
    };

    const parseMCQ = (text) => {
        const regex = /(\d+)[^\w]*([A-D])/gi; let match; const ans = {};
        while ((match = regex.exec(text)) !== null) { ans[match[1]] = match[2].toUpperCase(); }
        return ans;
    };

    const parseTF = (text) => {
        const lines = text.split('\n').filter(l => l.trim() !== ''); const ans = {}; let qNum = 1;
        lines.forEach(line => {
            const matches = line.match(/[ĐDS]/gi);
            if (matches && matches.length === 4) {
                 const numMatch = line.match(/^(\d+)/); const num = numMatch ? numMatch[1] : qNum;
                 ans[num] = matches.map(m => m.toUpperCase().replace('D', 'Đ')); qNum++;
            }
        }); return ans;
    };

    const parseSA = (text) => {
        const lines = text.split('\n').filter(l => l.trim() !== ''); const ans = {}; let qNum = 1;
        lines.forEach(line => {
            const match = line.match(/^(\d+)[\.:\-]\s*(.+)$/);
            if (match) { ans[match[1]] = match[2].trim(); } else { ans[qNum] = line.trim(); }
            qNum++;
        }); return ans;
    };

    const handleEditClick = (exam) => {
        const p1 = exam.answerKey?.part1 ? Object.entries(exam.answerKey.part1).map(([k, v]) => `${k}${v}`).join(' ') : '';
        const p2 = exam.answerKey?.part2 ? Object.entries(exam.answerKey.part2).map(([k, v]) => `${k}: ${v.join('')}`).join('\n') : '';
        const p3 = exam.answerKey?.part3 ? Object.entries(exam.answerKey.part3).map(([k, v]) => `${k}: ${v}`).join('\n') : '';

        setPdfFormData({
            format: '2025', title: exam.title, timeLimit: exam.timeLimit, pdfUrl: exam.pdfUrl, grade: exam.grade || '12',
            subject: exam.subject || 'Toán học', allowedClasses: exam.allowedClasses ? exam.allowedClasses.join(', ') : '',
            showAnswers: exam.showAnswers || false, answersP1: p1, answersP2: p2, answersP3: p3
        });
        setEditingExamId(exam.id);
        setShowPdfForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelForm = () => {
        setShowPdfForm(false); setEditingExamId(null);
        setPdfFormData({ format: '2025', title: '', timeLimit: 45, showAnswers: false, allowedClasses:'', answersP1:'', answersP2:'', answersP3:'', pdfUrl: '', grade: '12', subject: 'Toán học' }); 
    };

    const handleSavePdfExam = async (e) => {
        e.preventDefault();
        if (!pdfFormData.pdfUrl) return alert('⚠️ Vui lòng upload file đề thi PDF!');
        
        const p1Ans = parseMCQ(pdfFormData.answersP1);
        const p2Ans = parseTF(pdfFormData.answersP2);
        const p3Ans = parseSA(pdfFormData.answersP3);
        
        const answerKey = { part1: p1Ans, part2: p2Ans, part3: p3Ans };
        const totalQ = Object.keys(p1Ans).length + Object.keys(p2Ans).length + Object.keys(p3Ans).length;
        if (totalQ === 0) return alert('❌ Chưa có đáp án hợp lệ nào!');

        const classesArray = pdfFormData.allowedClasses.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

        try {
            const dataToSave = {
                title: pdfFormData.title, timeLimit: Number(pdfFormData.timeLimit), pdfUrl: pdfFormData.pdfUrl,
                format: '2025', answerKey: answerKey, totalQuestions: totalQ, grade: pdfFormData.grade,
                subject: pdfFormData.subject, allowedClasses: classesArray, showAnswers: pdfFormData.showAnswers 
            };

            if (editingExamId) {
                await updateDoc(doc(firestore, "pdf_exams", editingExamId), dataToSave);
                alert(`✅ Đã cập nhật thành công đề thi!`);
            } else {
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                await addDoc(collection(firestore, "pdf_exams"), {
                    ...dataToSave, authorId: user.uid, authorEmail: user.email, 
                    authorName: user.displayName || "Giáo viên", code: code, status: 'OPEN', createdAt: serverTimestamp()
                });
                alert(`✅ Đã lưu bộ đề thành công với ${totalQ} câu hỏi!`);
            }
            handleCancelForm(); 
            fetchPdfExams(user.uid, user.email, examFilterGrade, examFilterSubject, isSystemFilter); 
        } catch (err) { alert('Lỗi lưu dữ liệu: ' + err.message); }
    };

    const handleDeletePdfExam = async (id) => {
        if (confirm("⚠️ Xóa bộ đề này sẽ không thể khôi phục. Bạn chắc chắn chứ?")) {
            await deleteDoc(doc(firestore, "pdf_exams", id));
            setPdfExams(p => p.filter(q => q.id !== id));
            if (editingExamId === id) handleCancelForm();
        }
    };

    const filteredStudentResults = studentResults.filter(student => {
        const passGrade = filterGrade === 'Tất cả' || student.grade === filterGrade;
        const passSubject = filterSubject === 'Tất cả' || student.subject === filterSubject;
        const passClass = filterClassName === 'Tất cả' || student.className === filterClassName;
        return passGrade && passSubject && passClass;
    });

    const handleSelectAll = (e) => {
        if(e.target.checked) setSelectedRows(filteredStudentResults.map(s => s.key));
        else setSelectedRows([]);
    };

    const handleSelectRow = (key) => {
        setSelectedRows(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const handleBulkDeleteStudents = async () => {
        if(!confirm(`⚠️ Bạn chuẩn bị xóa TOÀN BỘ DỮ LIỆU BÀI LÀM của ${selectedRows.length} học sinh. Hành động này không thể hoàn tác. Tiếp tục?`)) return;
        setIsDeletingStudents(true);
        try {
            let idsToDelete = [];
            selectedRows.forEach(key => {
                const row = studentResults.find(r => r.key === key);
                if(row) idsToDelete.push(...row.docIds);
            });
            for(const id of idsToDelete) { await deleteDoc(doc(firestore, "pdf_exam_results", id)); }
            setSelectedRows([]);
            await fetchStudentResults(user.uid, myTeacherCode); 
            alert("✅ Đã xóa thành công!");
        } catch(err) { alert("Lỗi khi xóa: " + err.message); }
        setIsDeletingStudents(false);
    };

    const handleViewAttemptDetails = async (attempt, studentName) => {
        setIsFetchingAttempt(true);
        try {
            let examData = pdfExams.find(e => e.id === attempt.examId);
            if (!examData) {
                const docSnap = await getDoc(doc(firestore, "pdf_exams", attempt.examId));
                if (docSnap.exists()) {
                    examData = { id: docSnap.id, ...docSnap.data() };
                }
            }
            setSelectedAttempt({ ...attempt, studentName, examData });
        } catch (err) {
            console.error(err);
            alert("Lỗi tải chi tiết bài làm: " + err.message);
        } finally {
            setIsFetchingAttempt(false);
        }
    };

    // ========== TÍNH TOÁN THỐNG KÊ TRƯỚC KHI RENDER MODAL ==========
    let p1Correct = 0, p1Total = 0, p1Score = 0;
    let p2Score = 0, p2Total = 0;
    let p3Correct = 0, p3Total = 0, p3Score = 0;

    if (selectedAttempt && selectedAttempt.examData) {
        // Tính thống kê Phần 1
        if (selectedAttempt.examData.answerKey?.part1) {
            p1Total = Object.keys(selectedAttempt.examData.answerKey.part1).length;
            Object.entries(selectedAttempt.examData.answerKey.part1).forEach(([q, trueAns]) => {
                if (selectedAttempt.answers?.part1?.[q] === trueAns) p1Correct++;
            });
            p1Score = p1Correct * 0.25;
        }

        // Tính thống kê Phần 2
        if (selectedAttempt.examData.answerKey?.part2) {
            p2Total = Object.keys(selectedAttempt.examData.answerKey.part2).length;
            Object.entries(selectedAttempt.examData.answerKey.part2).forEach(([q, ansArrData]) => {
                const ansArr = Array.isArray(ansArrData) ? ansArrData : Object.values(ansArrData || {});
                const stuAnsObj = selectedAttempt.answers?.part2?.[q] || {};
                let matchCount = 0;
                ansArr.forEach((trueVal, idx) => { if(stuAnsObj[idx] === trueVal) matchCount++; });
                if(matchCount === 1) p2Score += 0.1;
                else if(matchCount === 2) p2Score += 0.25;
                else if(matchCount === 3) p2Score += 0.5;
                else if(matchCount === 4) p2Score += 1.0;
            });
        }

        // Tính thống kê Phần 3
        if (selectedAttempt.examData.answerKey?.part3) {
            p3Total = Object.keys(selectedAttempt.examData.answerKey.part3).length;
            Object.entries(selectedAttempt.examData.answerKey.part3).forEach(([q, trueAns]) => {
                const stuAnsRaw = selectedAttempt.answers?.part3?.[q] || "";
                const stuAns = String(stuAnsRaw).trim().toLowerCase();
                const trueAnsLower = String(trueAns).trim().toLowerCase();
                if (stuAns === trueAnsLower && stuAns !== "") p3Correct++;
            });
            p3Score = p3Correct * 0.5;
        }
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white"><Loader2 className="animate-spin text-cyan-400 drop-shadow-[0_0_20px_#06b6d4]" size={60} /></div>;

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-cyan-500 selection:text-white pb-20 relative">
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-[#020617] to-black -z-20"></div>

            <header className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-xl border-b border-cyan-500/30 shadow-[0_5px_30px_rgba(6,182,212,0.2)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[70px] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => router.push('/dashboard')} className="p-2.5 bg-slate-900 hover:bg-cyan-900/50 rounded-xl text-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-500/50 flex items-center gap-2 group">
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">Dashboard</span>
                        </button>
                        <div className="h-6 w-px bg-cyan-500/30"></div>
                        <div className="flex items-center gap-2 font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-tighter text-xl drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                            <Shield className="text-cyan-400" size={24} /> QUẢN TRỊ ARENA ÔN THI
                        </div>
                    </div>

                    {user && (
                        <div className="flex items-center gap-6">
                            <div className="hidden md:flex flex-col items-end border-r border-cyan-900 pr-6">
                                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest flex items-center gap-1"><Key size={10}/> Mã GV của bạn</span>
                                <span className="text-lg font-black text-cyan-300 leading-none mt-1 tracking-widest drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]">{myTeacherCode}</span>
                            </div>
                            <div className="text-right hidden sm:block">
                                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Tài khoản Admin</div>
                                <div className="text-sm font-bold text-white flex items-center justify-end gap-1"><CheckCircle size={12} className="text-emerald-500"/> {user.email}</div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
                <div className="flex flex-col md:flex-row justify-end items-start md:items-end gap-6 mb-10 animate-in fade-in slide-in-from-bottom-4">
                    {!showPdfForm && (
                        <button onClick={() => { setEditingExamId(null); setShowPdfForm(true); }} className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-black shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all hover:scale-105 uppercase italic border bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-cyan-400/50">
                            <Plus size={20} strokeWidth={3} /> Tạo Đề Mới Ngay
                        </button>
                    )}
                </div>

                {showPdfForm && (
                    <div className="bg-[#0f172a]/90 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.2)] relative overflow-hidden mb-12 animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-cyan-900/50 pb-4 mb-6 relative z-10 gap-4">
                            <div className="flex items-center gap-3">
                                <div className={`${editingExamId ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]'} p-2.5 rounded-xl border`}>
                                    <ListChecks size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-wide">
                                        THIẾT LẬP ĐỀ THI CHUẨN 2025
                                    </h2>
                                </div>
                            </div>
                            <button type="button" onClick={handleCancelForm} className="bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 p-2.5 rounded-xl transition-all border border-slate-700 hover:border-red-500/50 shadow-inner">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePdfExam} className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-cyan-400 mb-2 uppercase tracking-widest drop-shadow-md">1. Tên Kì Thi / Mã Đề</label>
                                    <input type="text" required value={pdfFormData.title} onChange={e => setPdfFormData({ ...pdfFormData, title: e.target.value })} className="w-full bg-black/50 border border-slate-700 focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] p-4 rounded-xl text-white font-bold outline-none transition-all placeholder:text-slate-600" placeholder="Nhập tên bài thi..."/>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-cyan-400 mb-2 uppercase tracking-widest flex items-center gap-1"><GraduationCap size={12}/> 2. Khối Lớp</label>
                                        <select required value={pdfFormData.grade} onChange={e => setPdfFormData({ ...pdfFormData, grade: e.target.value })} className="w-full bg-black/50 border border-slate-700 focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] p-3 rounded-xl text-white font-bold outline-none transition-all appearance-none cursor-pointer text-sm">
                                            {GRADES.map(g => <option key={`grad-${g}`} value={g}>{g === 'Khác' ? 'Khác' : `Lớp ${g}`}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-cyan-400 mb-2 uppercase tracking-widest flex items-center gap-1"><BookOpen size={12}/> 3. Môn Học</label>
                                        <select required value={pdfFormData.subject} onChange={e => setPdfFormData({ ...pdfFormData, subject: e.target.value })} className="w-full bg-black/50 border border-slate-700 focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] p-3 rounded-xl text-white font-bold outline-none transition-all appearance-none cursor-pointer text-sm">
                                            {SUBJECTS.map(s => <option key={`subj-${s.id}`} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-cyan-400 mb-2 uppercase tracking-widest flex items-center gap-1"><Users size={12}/> 4. Các Lớp Chỉ Định</label>
                                        <input 
                                            type="text" value={pdfFormData.allowedClasses} onChange={e => setPdfFormData({ ...pdfFormData, allowedClasses: e.target.value })} 
                                            placeholder="VD: 12A1, 12A2..." 
                                            className="w-full bg-black/50 border border-slate-700 focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] p-3 rounded-xl text-white font-bold outline-none transition-all text-sm uppercase placeholder:normal-case placeholder:text-slate-600"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-cyan-400 mb-2 uppercase tracking-widest">5. Thời Gian (Phút)</label>
                                        <input type="number" required min="5" value={pdfFormData.timeLimit} onChange={e => setPdfFormData({ ...pdfFormData, timeLimit: e.target.value })} className="w-full bg-black/50 border border-slate-700 focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] p-4 rounded-xl text-white font-black text-center text-xl outline-none transition-all" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="block text-[10px] font-bold text-cyan-400 mb-2 uppercase tracking-widest">6. Tải Lên Đề (PDF)</label>
                                        <div className="flex items-center gap-2 h-[60px]">
                                            <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-700 hover:border-cyan-400 text-cyan-300 hover:text-white p-4 rounded-xl font-bold transition-all h-full shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]">
                                                {isUploadingPdf ? <Loader2 className="animate-spin" size={20} /> : <UploadCloud size={20} />}
                                                {isUploadingPdf ? 'Đang Xử...' : (pdfFormData.pdfUrl ? 'Đổi file .PDF' : 'Chọn file')}
                                                <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
                                            </label>
                                            
                                            {pdfFormData.pdfUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPdfFormData(prev => ({ ...prev, pdfUrl: '' }))}
                                                    className="h-full px-4 flex items-center justify-center bg-red-900/30 hover:bg-red-600 border border-red-700 hover:border-red-400 text-red-400 hover:text-white rounded-xl transition-all shadow-sm"
                                                    title="Xóa file PDF"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {pdfFormData.pdfUrl && (
                                    <div className="bg-emerald-950/40 border border-emerald-500/50 p-3 rounded-xl text-emerald-400 text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                        <CheckCircle size={18} /> Đã nạp PDF thành công!
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 flex flex-col h-full bg-black/40 p-5 rounded-2xl border border-slate-800 shadow-inner">
                                <div className="flex justify-between items-center mb-1 border-b border-slate-800 pb-3">
                                    <label className="text-sm font-black text-orange-500 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]">KHUNG ĐÁP ÁN</label>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={downloadSampleExcel} className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg flex items-center gap-2 text-[10px] font-bold transition-all border border-slate-600 shadow-md">
                                            <UploadCloud size={14} className="rotate-180"/> Tải Form
                                        </button>
                                        <label className="cursor-pointer bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-[10px] font-bold transition-all shadow-[0_0_10px_rgba(16,185,129,0.4)] border border-emerald-400">
                                            <FileSpreadsheet size={14}/> Nạp Excel
                                            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} />
                                        </label>
                                    </div>
                                </div>

                                <label className="flex items-center gap-3 cursor-pointer bg-slate-900 border border-slate-700 p-3 rounded-xl hover:border-cyan-500/50 transition-colors w-fit shadow-sm">
                                    <input 
                                        type="checkbox" checked={pdfFormData.showAnswers} onChange={e => setPdfFormData({...pdfFormData, showAnswers: e.target.checked})}
                                        className="w-4 h-4 accent-cyan-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Cho phép HS xem đáp án sau khi nộp</span>
                                </label>

                                <div className="flex-1 flex flex-col gap-3">
                                    <div>
                                        <div className="text-[10px] font-bold text-cyan-400 mb-1 uppercase tracking-wider">Phần I: Câu trắc nghiệm</div>
                                        <textarea value={pdfFormData.answersP1} onChange={e => setPdfFormData({ ...pdfFormData, answersP1: e.target.value })} className="w-full h-16 bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-white font-mono text-sm outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all resize-none" placeholder="VD: 1A 2B 3C 4D" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-pink-400 mb-1 uppercase tracking-wider">Phần II: Câu Đúng/Sai</div>
                                        <textarea value={pdfFormData.answersP2} onChange={e => setPdfFormData({ ...pdfFormData, answersP2: e.target.value })} className="w-full h-24 bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-white font-mono text-sm outline-none focus:border-pink-500 focus:shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all resize-none" placeholder="VD: 1: Đ S Đ S&#10;2: S S Đ Đ" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-yellow-400 mb-1 uppercase tracking-wider">Phần III: Trả lời ngắn</div>
                                        <textarea value={pdfFormData.answersP3} onChange={e => setPdfFormData({ ...pdfFormData, answersP3: e.target.value })} className="w-full h-24 bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-white font-mono text-sm outline-none focus:border-yellow-500 focus:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all resize-none" placeholder="VD: 1: 45&#10;2: -0.5" />
                                    </div>
                                </div>

                                <button type="submit" disabled={isUploadingPdf} className={`w-full text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 mt-2 hover:scale-[1.02] active:scale-95 ${editingExamId ? 'bg-gradient-to-r from-orange-600 to-amber-600 shadow-[0_0_20px_rgba(249,115,22,0.5)] border border-orange-400' : 'bg-gradient-to-r from-cyan-600 to-blue-600 shadow-[0_0_20px_rgba(6,182,212,0.5)] border border-cyan-400'}`}>
                                    {isUploadingPdf ? <Loader2 className="animate-spin" size={20}/> : (editingExamId ? <><Edit size={20} /> Cập Nhật Đề Thi</> : <><Save size={20} /> Tạo Mật Lệnh</>)}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* QUẢN LÝ ĐỀ THI - ĐÃ THÊM BỘ LỌC */}
                <div className="bg-[#0f172a]/90 backdrop-blur-md rounded-[2rem] border border-cyan-900/50 shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden mt-8 mb-12">
                    <div className="bg-slate-950/80 p-5 border-b border-cyan-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <FileText className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"/>
                            <div>
                                <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 uppercase tracking-widest">Danh Sách Đề Thi</h2>
                                {user?.email === 'luonggioi68@gmail.com' && isSystemFilter && (
                                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-0.5">Đang hiển thị toàn hệ thống (Admin)</p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Filter size={16} className="text-cyan-500 hidden xl:block drop-shadow-md"/>
                            <select value={examFilterGrade} onChange={e => setExamFilterGrade(e.target.value)} className="bg-black/50 border border-slate-700 text-slate-300 focus:text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-cyan-500 transition-all">
                                <option value="Tất cả">Mọi Khối Lớp</option>
                                {GRADES.map(g => <option key={`eg-${g}`} value={g}>{g === 'Khác' ? 'Khác' : `Lớp ${g}`}</option>)}
                            </select>
                            <select value={examFilterSubject} onChange={e => setExamFilterSubject(e.target.value)} className="bg-black/50 border border-slate-700 text-slate-300 focus:text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-cyan-500 transition-all">
                                <option value="Tất cả">Mọi Môn Học</option>
                                {SUBJECTS.map(s => <option key={`es-${s.id}`} value={s.id}>{s.name}</option>)}
                            </select>
                            <button
                                onClick={() => fetchPdfExams(user.uid, user.email, examFilterGrade, examFilterSubject, user?.email === 'luonggioi68@gmail.com')}
                                className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                            >
                                Lọc
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[800px]">
                            <thead className="bg-black/40 text-cyan-500 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10 border-b border-slate-800">
                                <tr>
                                    <th className="p-5 w-12 text-center">STT</th>
                                    <th className="p-5 w-24">Mã Đề</th>
                                    <th className="p-5 w-1/3">Thông tin Đề Thi</th>
                                    <th className="p-5 text-center">Số câu</th>
                                    <th className="p-5 text-center">Thời gian</th>
                                    <th className="p-5 text-center">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {pdfExams.map((q, i) => (
                                    <tr key={`pe-${q.id}`} className="hover:bg-slate-800/40 transition-colors group">
                                        <td className="p-5 text-center text-slate-500 font-mono text-sm">{i + 1}</td>
                                        <td className="p-5">
                                            <span className="bg-cyan-950/50 text-cyan-400 border border-cyan-700/50 px-2.5 py-1 rounded text-xs font-black shadow-[0_0_10px_rgba(6,182,212,0.2)] uppercase tracking-widest">{q.code}</span>
                                        </td>
                                        <td className="p-5">
                                            <div className="font-bold text-white text-base mb-2 group-hover:text-cyan-300 transition-colors">{q.title}</div>
                                            <div className="flex items-center flex-wrap gap-2 text-[9px] font-black uppercase tracking-wider">
                                                <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600">Lớp {q.grade || '---'}</span>
                                                <span className="bg-indigo-950 text-indigo-300 px-2 py-1 rounded border border-indigo-800">{SUBJECTS.find(s => s.id === q.subject)?.name || q.subject || '---'}</span>
                                                {q.allowedClasses && q.allowedClasses.length > 0 && <span className="bg-purple-950 text-purple-300 px-2 py-1 rounded border border-purple-800 shadow-[0_0_8px_rgba(168,85,247,0.3)]">Giao cho: {q.allowedClasses.join(', ')}</span>}
                                                {q.showAnswers && <span className="bg-emerald-950 text-emerald-400 px-2 py-1 rounded border border-emerald-800 shadow-[0_0_8px_rgba(16,185,129,0.3)]">Mở Đáp Án</span>}
                                                
                                                {isSystemFilter && (
                                                    <span className="bg-red-950/70 text-red-400 px-2 py-1 rounded border border-red-800 shadow-[0_0_8px_rgba(239,68,68,0.3)] truncate max-w-[200px]" title={q.authorEmail || q.authorName || 'Ẩn danh'}>
                                                        Tạo bởi: {q.authorEmail || q.authorName || 'Ẩn danh'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-5 text-center font-black text-cyan-400 text-xl drop-shadow-md">{q.totalQuestions || 0}</td>
                                        <td className="p-5 text-center font-black text-orange-400 text-xl drop-shadow-md">{q.timeLimit}<span className="text-xs text-slate-500 ml-0.5">p</span></td>
                                        <td className="p-5 text-center">
                                            <div className="flex justify-center gap-3">
                                                <button type="button" onClick={() => handleEditClick(q)} className="bg-blue-900/30 hover:bg-blue-600 text-blue-400 hover:text-white p-2.5 rounded-xl transition-all border border-blue-700/50 shadow-md hover:scale-110">
                                                    <Edit size={16}/>
                                                </button>
                                                <button type="button" onClick={() => handleDeletePdfExam(q.id)} className="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white p-2.5 rounded-xl transition-all border border-red-800/50 shadow-md hover:scale-110">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* DANH SÁCH HỌC SINH */}
                <div className="bg-[#0f172a]/90 backdrop-blur-md rounded-[2rem] border border-orange-500/30 shadow-[0_10px_50px_rgba(249,115,22,0.15)] overflow-hidden mt-8 mb-12 relative">
                    <div className="bg-slate-950/80 p-5 border-b border-orange-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-gradient-to-br from-orange-500 to-red-600 p-2.5 rounded-xl shadow-[0_0_15px_rgba(249,115,22,0.5)] border border-orange-400">
                                    <Target className="text-white" size={20}/>
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400 uppercase tracking-widest drop-shadow-md">Thống Kê Học Sinh</h2>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5 font-bold">Nguồn dữ liệu: Mã GV {myTeacherCode}</p>
                                </div>
                            </div>
                            {selectedRows.length > 0 && (
                                <button 
                                    type="button" onClick={handleBulkDeleteStudents} disabled={isDeletingStudents}
                                    className="ml-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 border border-red-400 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-widest animate-in zoom-in shadow-[0_0_20px_rgba(239,68,68,0.6)] transition-all active:scale-95"
                                >
                                    {isDeletingStudents ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}
                                    Xóa {selectedRows.length} Lịch Sử Chọn 
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <Filter size={16} className="text-orange-500 hidden xl:block drop-shadow-md"/>
                            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="bg-black/50 border border-slate-700 text-slate-300 focus:text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.3)] transition-all">
                                <option value="Tất cả">Mọi Khối Lớp</option>
                                {GRADES.map(g => <option key={`fg-${g}`} value={g}>Lớp {g}</option>)}
                            </select>
                            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="bg-black/50 border border-slate-700 text-slate-300 focus:text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.3)] transition-all">
                                <option value="Tất cả">Mọi Môn Học</option>
                                {SUBJECTS.map(s => <option key={`fs-${s.id}`} value={s.id}>{s.name}</option>)}
                            </select>
                            <select value={filterClassName} onChange={e => setFilterClassName(e.target.value)} className="bg-black/50 border border-slate-700 text-slate-300 focus:text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(249,115,22,0.3)] transition-all">
                                <option value="Tất cả">Mọi Tên Lớp</option>
                                {availableClasses.map(c => <option key={`fc-${c}`} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[700px]">
                            <thead className="bg-black/40 text-orange-400 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10 border-b border-slate-800">
                                <tr>
                                    <th className="p-5 w-12 text-center">
                                        <input 
                                            type="checkbox" className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                                            checked={selectedRows.length > 0 && selectedRows.length === filteredStudentResults.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="p-5 w-12 text-center">TT</th>
                                    <th className="p-5 w-1/4">Họ Tên & Lớp</th>
                                    <th className="p-5">Chi Tiết Lượt Thi (Bấm vào để xem)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredStudentResults.length > 0 ? filteredStudentResults.map((hs, idx) => (
                                    <tr key={hs.key} className="hover:bg-slate-800/40 transition-colors group">
                                        <td className="p-5 text-center">
                                            <input 
                                                type="checkbox" className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                                                checked={selectedRows.includes(hs.key)} onChange={() => handleSelectRow(hs.key)}
                                            />
                                        </td>
                                        <td className="p-5 text-center text-slate-500 font-mono text-sm">{idx + 1}</td>
                                        <td className="p-5">
                                            <div className="font-bold text-white text-sm mb-1.5 group-hover:text-orange-300 transition-colors">{hs.name}</div>
                                            <div className="flex flex-wrap gap-2 font-black text-[9px] uppercase tracking-wider">
                                                <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600">Khối {hs.grade}</span>
                                                <span className="bg-indigo-950 text-indigo-300 px-2 py-1 rounded border border-indigo-800">{SUBJECTS.find(s => s.id === hs.subject)?.name || hs.subject}</span>
                                                <span className="bg-orange-950 text-orange-400 px-2 py-1 rounded border border-orange-700 shadow-[0_0_8px_rgba(249,115,22,0.3)]">{hs.className}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-wrap gap-2.5">
                                                {hs.attempts.map((attempt, i) => (
                                                    <button 
                                                        key={`sc-${i}`} 
                                                        onClick={() => handleViewAttemptDetails(attempt, hs.name)}
                                                        className="bg-black/50 border border-cyan-800/60 px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-colors cursor-pointer group/btn"
                                                        title="Xem chi tiết bài làm"
                                                    >
                                                        <span className="text-[10px] text-slate-400 uppercase font-black group-hover/btn:text-cyan-300">L{i + 1}:</span>
                                                        <span className="text-sm font-black text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] group-hover/btn:scale-110 transition-transform">{attempt.score.toFixed(2)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="p-16 text-center">
                                            <Users size={40} className="mx-auto text-slate-700 mb-4 drop-shadow-md"/>
                                            <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Chưa có dữ liệu tác chiến</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* MODAL XEM CHI TIẾT BÀI LÀM */}
            {isFetchingAttempt && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="animate-spin text-orange-500" size={50} />
                </div>
            )}

            {selectedAttempt && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
                     <div className="bg-[#0f172a] border-2 border-orange-500/50 rounded-[2rem] w-full max-w-5xl max-h-[90vh] shadow-[0_0_50px_rgba(249,115,22,0.3)] flex flex-col relative animate-in zoom-in-95 duration-200">
                         {/* Header Modal */}
                         <div className="p-6 border-b border-slate-800 flex justify-between items-start shrink-0 relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-600"></div>
                             <div>
                                 <h2 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 uppercase tracking-tighter flex items-center gap-2">
                                     <Eye size={24} className="text-orange-500" /> BÁO CÁO CHI TIẾT TRẬN ĐÁNH
                                 </h2>
                                 <div className="flex flex-wrap gap-4 mt-3">
                                     <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
                                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Chiến binh</span>
                                         <span className="text-sm font-black text-white">{selectedAttempt.studentName}</span>
                                     </div>
                                     <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
                                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Nhiệm vụ</span>
                                         <span className="text-sm font-black text-white truncate max-w-[200px] inline-block align-bottom" title={selectedAttempt.examTitle}>{selectedAttempt.examTitle}</span>
                                     </div>
                                     <div className="bg-orange-950/30 px-3 py-1.5 rounded-lg border border-orange-500/30">
                                         <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest block mb-0.5">Điểm Tổng Lực</span>
                                         <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)] leading-none">{selectedAttempt.score.toFixed(2)}</span>
                                     </div>
                                 </div>
                             </div>
                             <button onClick={() => setSelectedAttempt(null)} className="p-2 bg-slate-900 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-800">
                                 <X size={20} />
                             </button>
                         </div>

                         {/* Nội dung chi tiết */}
                         <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 bg-black/40">
                             {!selectedAttempt.examData ? (
                                 <div className="text-center py-10">
                                     <FileCheck size={40} className="mx-auto text-red-500/50 mb-3" />
                                     <p className="text-red-400 font-bold">Rất tiếc, bộ đề gốc đã bị xóa khỏi hệ thống.</p>
                                     <p className="text-sm text-slate-500">Không thể đối chiếu đáp án chi tiết.</p>
                                 </div>
                             ) : (
                                 <div className="space-y-8">
                                     {/* PHẦN 1: TRẮC NGHIỆM */}
                                     {selectedAttempt.examData.answerKey?.part1 && Object.keys(selectedAttempt.examData.answerKey.part1).length > 0 && (
                                         <div>
                                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-cyan-900/50 pb-2">
                                                 <h4 className="text-cyan-500 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                                     <Target size={16}/> I. TRẮC NGHIỆM (0.25đ / Câu)
                                                 </h4>
                                                 <div className="bg-cyan-950/50 text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-800 text-[10px] md:text-xs font-black shadow-inner flex items-center gap-3">
                                                     <span>ĐÚNG: <span className="text-white bg-black/50 px-2 py-0.5 rounded ml-1">{p1Correct}/{p1Total}</span></span>
                                                     <span className="w-px h-3 bg-cyan-700"></span>
                                                     <span>ĐIỂM: <span className="text-emerald-400 bg-black/50 px-2 py-0.5 rounded ml-1">{p1Score.toFixed(2)}</span></span>
                                                 </div>
                                             </div>
                                             <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                                                 {Object.entries(selectedAttempt.examData.answerKey.part1).sort(([a],[b])=>a-b).map(([q, trueAns]) => {
                                                     const stuAns = selectedAttempt.answers?.part1?.[q];
                                                     const isCorrect = stuAns === trueAns;
                                                     return (
                                                         <div key={q} className={`flex flex-col items-center justify-center p-2.5 rounded-xl border relative shadow-sm ${isCorrect ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-red-950/30 border-red-500/40'}`}>
                                                             <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Câu {q}</span>
                                                             <div className="flex items-center gap-1.5 text-base font-black">
                                                                 <span className={isCorrect ? 'text-emerald-400 drop-shadow-md' : 'text-red-400 line-through'}>{stuAns || '-'}</span>
                                                                 {!isCorrect && <span className="text-emerald-400 drop-shadow-md">{trueAns}</span>}
                                                             </div>
                                                             {isCorrect && <CheckCircle size={10} className="text-emerald-500 absolute top-1.5 right-1.5" />}
                                                         </div>
                                                     )
                                                 })}
                                             </div>
                                         </div>
                                     )}

                                     {/* PHẦN 2: ĐÚNG / SAI */}
                                     {selectedAttempt.examData.answerKey?.part2 && Object.keys(selectedAttempt.examData.answerKey.part2).length > 0 && (
                                         <div>
                                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-yellow-900/50 pb-2">
                                                 <h4 className="text-yellow-500 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                                     <CheckCircle size={16}/> II. ĐÚNG / SAI (Tối đa 1đ / Câu)
                                                 </h4>
                                                 <div className="bg-yellow-950/50 text-yellow-300 px-3 py-1.5 rounded-lg border border-yellow-800 text-[10px] md:text-xs font-black shadow-inner flex items-center gap-2">
                                                     <span>TỔNG ĐIỂM: <span className="text-emerald-400 bg-black/50 px-2 py-0.5 rounded ml-1">{p2Score.toFixed(2)}</span></span>
                                                 </div>
                                             </div>
                                             <div className="space-y-3">
                                                 {Object.entries(selectedAttempt.examData.answerKey.part2).sort(([a],[b])=>a-b).map(([q, ansArrData]) => {
                                                     const ansArr = Array.isArray(ansArrData) ? ansArrData : Object.values(ansArrData || {});
                                                     const stuAnsObj = selectedAttempt.answers?.part2?.[q] || {};
                                                     
                                                     let matchCount = 0;
                                                     ansArr.forEach((trueVal, idx) => { if(stuAnsObj[idx] === trueVal) matchCount++; });
                                                     
                                                     let qScore = 0;
                                                     if(matchCount === 1) qScore = 0.1;
                                                     else if(matchCount === 2) qScore = 0.25;
                                                     else if(matchCount === 3) qScore = 0.5;
                                                     else if(matchCount === 4) qScore = 1.0;

                                                     return (
                                                         <div key={q} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 shadow-inner">
                                                             <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-center min-w-[100px] shrink-0">
                                                                 <span className="text-slate-300 font-black text-sm uppercase">Câu {q}</span>
                                                                 <span className="text-[10px] font-black text-yellow-400 bg-yellow-900/30 px-2.5 py-1 rounded border border-yellow-500/20">+{qScore}đ</span>
                                                             </div>
                                                             <div className="flex flex-wrap gap-3 flex-1">
                                                                 {ansArr.map((trueVal, i) => {
                                                                     const stuAns = stuAnsObj[i];
                                                                     const isCorrect = stuAns === trueVal;
                                                                     return (
                                                                         <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 min-w-[120px] justify-between shadow-sm ${isCorrect ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-red-950/30 border-red-500/40'}`}>
                                                                             <span className="text-[11px] font-black text-slate-500 uppercase bg-black/50 w-6 h-6 flex items-center justify-center rounded-md border border-slate-800">Ý {['A','B','C','D'][i]}</span>
                                                                             <div className="flex items-center gap-1.5 text-sm font-black">
                                                                                 <span className={isCorrect ? 'text-emerald-400 drop-shadow-md' : 'text-red-400 line-through'}>{stuAns || '-'}</span>
                                                                                 {!isCorrect && <span className="text-emerald-400 drop-shadow-md">({trueVal})</span>}
                                                                             </div>
                                                                         </div>
                                                                     )
                                                                 })}
                                                             </div>
                                                         </div>
                                                     )
                                                 })}
                                             </div>
                                         </div>
                                     )}

                                     {/* PHẦN 3: TRẢ LỜI NGẮN */}
                                     {selectedAttempt.examData.answerKey?.part3 && Object.keys(selectedAttempt.examData.answerKey.part3).length > 0 && (
                                         <div>
                                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-orange-900/50 pb-2">
                                                 <h4 className="text-orange-500 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                                     <Edit size={16}/> III. TRẢ LỜI NGẮN (0.5đ / Câu)
                                                 </h4>
                                                 <div className="bg-orange-950/50 text-orange-300 px-3 py-1.5 rounded-lg border border-orange-800 text-[10px] md:text-xs font-black shadow-inner flex items-center gap-3">
                                                     <span>ĐÚNG: <span className="text-white bg-black/50 px-2 py-0.5 rounded ml-1">{p3Correct}/{p3Total}</span></span>
                                                     <span className="w-px h-3 bg-orange-700"></span>
                                                     <span>ĐIỂM: <span className="text-emerald-400 bg-black/50 px-2 py-0.5 rounded ml-1">{p3Score.toFixed(2)}</span></span>
                                                 </div>
                                             </div>
                                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                 {Object.entries(selectedAttempt.examData.answerKey.part3).sort(([a],[b])=>a-b).map(([q, trueAns]) => {
                                                     const stuAnsRaw = selectedAttempt.answers?.part3?.[q] || "";
                                                     const stuAns = String(stuAnsRaw).trim().toLowerCase();
                                                     const trueAnsLower = String(trueAns).trim().toLowerCase();
                                                     const isCorrect = stuAns === trueAnsLower && stuAns !== "";
                                                     
                                                     return (
                                                         <div key={q} className={`flex flex-col p-4 rounded-2xl border shadow-sm ${isCorrect ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-red-950/30 border-red-500/40'}`}>
                                                             <div className="flex justify-between items-center mb-3">
                                                                 <span className="text-slate-300 font-black text-xs uppercase bg-black/50 px-2 py-1 rounded border border-slate-800">Câu {q}</span>
                                                                 {isCorrect && <span className="text-[10px] font-black text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20">+0.5đ</span>}
                                                             </div>
                                                             <div className="flex flex-col gap-2">
                                                                 <div className="flex justify-between items-center bg-black/40 p-2 rounded-lg border border-slate-800/50">
                                                                     <span className="text-[10px] text-slate-500 uppercase font-black">HS Điền:</span>
                                                                     <span className={`text-sm font-black ${isCorrect ? 'text-emerald-400 drop-shadow-md' : 'text-red-400 line-through'}`}>{stuAnsRaw || '(Trống)'}</span>
                                                                 </div>
                                                                 {!isCorrect && (
                                                                     <div className="flex justify-between items-center bg-emerald-950/20 p-2 rounded-lg border border-emerald-900/50">
                                                                         <span className="text-[10px] text-emerald-500/80 uppercase font-black">Đ/A Gốc:</span>
                                                                         <span className="text-sm font-black text-emerald-400 drop-shadow-md">{trueAns}</span>
                                                                     </div>
                                                                 )}
                                                             </div>
                                                         </div>
                                                     )
                                                 })}
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}
                         </div>
                     </div>
                     
                     {/* CSS cho thanh cuộn bên trong Modal */}
                     <style jsx>{`
                        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ea580c; border-radius: 4px; }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; }
                     `}</style>
                </div>
            )}
        </div>
    );
}