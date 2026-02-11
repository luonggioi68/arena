import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
    Plus, Trash2, Save, ArrowLeft, CheckCircle, Sparkles, X, Loader2, List, 
    CheckSquare, Type, BrainCircuit, Upload, BookOpen, Image as ImageIcon, 
    Users, Calculator, Info, Clock, Hash, GraduationCap, Book, RefreshCcw, Eye 
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import katex from "katex"; 
import MathRender from '@/components/MathRender'; 

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dcnsjzq0i/image/upload"; 
const UPLOAD_PRESET = "gameedu"; 

// --- DANH SÁCH MÔN HỌC & KHỐI ---
const SUBJECT_OPTIONS = [
    "Toán học", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học",
    "Tin học", "Lịch sử", "Địa lí", "Giáo dục công dân", "Giáo dục kinh tế và pháp luật",
    "Công nghệ", "Khoa học tự nhiên", "Lịch sử và Địa lí", 
    "Tiếng Việt", "Khoa học", "Đạo đức", "Tự nhiên và Xã hội",
    "Giáo dục quốc phòng và an ninh", "Giáo dục thể chất", 
    "Âm nhạc", "Mỹ thuật", "Hoạt động trải nghiệm", "Khác"
];

const GRADE_OPTIONS = ["12", "11", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1"];

// --- HÀM CHUYỂN ĐỔI LATEX -> MATHML ---
const convertToMathML = (text) => {
    if (!text) return "";
    return text
        .replace(/\\\[(.*?)\\\]|\$\$(.*?)\$\$/g, (match, p1, p2) => {
            try { 
                return katex.renderToString(p1 || p2, { 
                    output: "mathml", throwOnError: false, displayMode: true 
                }); 
            } catch (e) { return match; }
        })
        .replace(/\\\((.*?)\\\)|\$(.*?)\$/g, (match, p1, p2) => {
            try { 
                return katex.renderToString(p1 || p2, { 
                    output: "mathml", throwOnError: false, displayMode: false 
                }); 
            } catch (e) { return match; }
        });
};

// --- HÀM RENDER VĂN BẢN KÈM ẢNH INLINE ---
const renderWithInlineImage = (text, imgUrl) => {
    if (!text) return null;
    
    // Nếu có thẻ [img] và có link ảnh
    if (text.includes('[img]') && imgUrl) {
        const parts = text.split('[img]');
        return (
            <span>
                {parts.map((part, index) => (
                    <span key={index}>
                        <MathRender content={part} />
                        {/* Nếu chưa phải phần cuối cùng thì chèn ảnh vào giữa */}
                        {index < parts.length - 1 && (
                            <img 
                                src={imgUrl} 
                                className="inline-block align-middle mx-1 max-h-12 border rounded bg-white shadow-sm" 
                                alt="minh-hoa"
                            />
                        )}
                    </span>
                ))}
            </span>
        );
    }
    
    // Mặc định trả về text chứa công thức toán
    return <MathRender content={text} />;
};

export default function CreateQuiz() {
  const router = useRouter();
  const { id, grade: queryGrade, subject: querySubject, from } = router.query;
  
  const fileInputRef = useRef(null);
  const qImgRef = useRef(null);
  const aImgRef = useRef(null);
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState({ qIndex: -1, aIndex: -1, type: '' });

  // State AI
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiSource, setAiSource] = useState('');
  const [aiLevel, setAiLevel] = useState('10');
  const [aiSubject, setAiSubject] = useState('Toán học');
  
  const [matrix, setMatrix] = useState({
    tn_biet: 0, tn_hieu: 0, tn_vd: 0, 
    ds_count: 0, ds_biet: 0, ds_hieu: 0, ds_vd: 0, 
    tl_biet: 0, tl_hieu: 0, tl_vd: 0, 
  });

  const [title, setTitle] = useState('');
  const [examCode, setExamCode] = useState(''); 
  const [grade, setGrade] = useState('10');
  const [subject, setSubject] = useState('');
  const [assignedClass, setAssignedClass] = useState('');
  const [duration, setDuration] = useState(45);
  const [scoreConfig, setScoreConfig] = useState({ p1: 6, p3: 1 });
  const [origin, setOrigin] = useState('LIBRARY');
  const [showFullPreview, setShowFullPreview] = useState(false);

  const [questions, setQuestions] = useState([
    { id: Date.now(), type: 'MCQ', part: 1, q: '', img: '', a: ['', '', '', ''], aImages: ['', '', '', ''], correct: 0 }
  ]);

  const generateExamCode = () => Math.floor(1000 + Math.random() * 9000).toString();

  const scoreStats = useMemo(() => {
    const p1Count = questions.filter(q => q.type === 'MCQ').length;
    const p2Count = questions.filter(q => q.type === 'TF').length;
    const p3Count = questions.filter(q => q.type === 'SA').length;
    return {
      p1Count, p2Count, p3Count,
      p1PerQ: p1Count > 0 ? (scoreConfig.p1 / p1Count).toFixed(2) : 0,
      p3PerQ: p3Count > 0 ? (scoreConfig.p3 / p3Count).toFixed(2) : 0,
      p2Total: p2Count * 1, 
      totalScore: parseFloat(scoreConfig.p1) + (p2Count * 1) + parseFloat(scoreConfig.p3)
    };
  }, [questions, scoreConfig]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) router.push('/');
      else setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
        if (id) {
            getDoc(doc(firestore, "quizzes", id)).then(snap => {
                if(snap.exists()) {
                    const data = snap.data();
                    setTitle(data.title || '');
                    setExamCode(data.examCode || generateExamCode());
                    setGrade(data.grade || '10');
                    setSubject(data.subject || '');
                    setAssignedClass(data.assignedClass || '');
                    setDuration(data.duration || 45);
                    if (data.scoreConfig) setScoreConfig(data.scoreConfig);
                    setOrigin(data.origin || 'LIBRARY');
                    
                    if (data.rawQuestions) {
                        const formattedQuestions = data.rawQuestions.map(q => {
                           if (q.type === 'TF') {
                               return {
                                   ...q,
                                   items: q.items.map(item => ({ ...item, img: item.img || '' }))
                               };
                           }
                           return q;
                        });
                        setQuestions(formattedQuestions);
                    } else {
                        setQuestions(data.questions.map(q => ({ 
                            ...q, 
                            img: q.img || '', 
                            aImages: q.aImages || ['', '', '', ''],
                            items: q.type === 'TF' ? (q.items || []).map(i => ({...i, img: i.img || ''})) : null
                        })));
                    }
                }
            });
        } else {
            setExamCode(generateExamCode());
            if (queryGrade) setGrade(queryGrade);
            if (querySubject) {
                const matchedSubject = SUBJECT_OPTIONS.find(s => s === querySubject || s === querySubject);
                setSubject(matchedSubject || querySubject);
            }
            if (from) setOrigin(from);
        }
    }
  }, [id, user, queryGrade, querySubject, from]);

  const handleImageUpload = async (file) => {
    if (!file) return null;
    setImgUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    try {
        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await res.json();
        setImgUploading(false);
        return data.secure_url;
    } catch (error) { setImgUploading(false); return null; }
  };

  const handlePaste = async (e, qIndex, type, subIndex = -1) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
              e.preventDefault(); 
              const blob = items[i].getAsFile();
              const url = await handleImageUpload(blob);
              if (!url) return;

              const newQs = [...questions];
              if (type === 'QUESTION') {
                  newQs[qIndex].img = url;
              } else if (type === 'ANSWER') {
                   if (!newQs[qIndex].aImages) newQs[qIndex].aImages = ['', '', '', ''];
                   newQs[qIndex].aImages[subIndex] = url;
              } else if (type === 'TF_ITEM') {
                   newQs[qIndex].items[subIndex].img = url;
              }
              setQuestions(newQs);
              break; 
          }
      }
  };

  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await handleImageUpload(file);
    if (!url) return;
    const newQs = [...questions];
    const { qIndex, aIndex, type } = uploadTarget;
    
    if (type === 'QUESTION') {
        newQs[qIndex].img = url;
    } else if (type === 'ANSWER') {
        if (!newQs[qIndex].aImages) newQs[qIndex].aImages = ['', '', '', ''];
        newQs[qIndex].aImages[aIndex] = url;
    } else if (type === 'TF_ITEM') {
        newQs[qIndex].items[aIndex].img = url;
    }
    setQuestions(newQs);
    e.target.value = null;
  };

  const triggerUpload = (qIdx, aIdx = -1, type = 'QUESTION') => {
    setUploadTarget({ qIndex: qIdx, aIndex: aIdx, type });
    if (type === 'QUESTION') qImgRef.current.click(); 
    else aImgRef.current.click();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: e.target.result });
        const parsedQuestions = parseDocxContent(result.value);
        if (parsedQuestions.length > 0) {
            setQuestions(prev => [...prev, ...parsedQuestions]);
            alert(`✅ Đã nhập ${parsedQuestions.length} câu hỏi!`);
        } else alert("⚠️ Không tìm thấy câu hỏi.");
      } catch (error) { console.error(error); alert("Lỗi đọc file Word!"); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null; 
  };

const sanitizeMathText = (text) => {
    if (!text) return "";
    return text
        .replace(/√/g, '\\sqrt').replace(/π/g, '\\pi').replace(/≤/g, '\\le')
        .replace(/≥/g, '\\ge').replace(/≠/g, '\\ne').replace(/±/g, '\\pm')
        .replace(/∈/g, '\\in').replace(/±/g, '\\pm').replace(/∓/g, '\\mp')
        .replace(/∑/g, '\\sum').replace(/∏/g, '\\prod').replace(/∫/g, '\\int')
        .replace(/∞/g, '\\infty').replace(/lim/g, '\\lim').replace(/α/g, '\\alpha')
        .replace(/β/g, '\\beta').replace(/γ/g, '\\gamma').replace(/Δ/g, '\\Delta')
        .replace(/δ/g, '\\delta').replace(/θ/g, '\\theta').replace(/λ/g, '\\lambda')
        .replace(/μ/g, '\\mu').replace(/π/g, '\\pi').replace(/σ/g, '\\sigma')
        .replace(/ω/g, '\\omega').replace(/→/g, '\\to').replace(/←/g, '\\leftarrow')
        .replace(/↔/g, '\\leftrightarrow').replace(/⇒/g, '\\Rightarrow')
        .replace(/⇐/g, '\\Leftarrow').replace(/°/g, '^\\circ')
        .replace(/⊂/g, '\\subset').replace(/∞/g, '\\infty').replace(/α/g, '\\alpha')
        .replace(/β/g, '\\beta').replace(/∆/g, '\\Delta')
        .replace(/≈/g, '\\approx').replace(/≡/g, '\\equiv').replace(/∧/g, '\\land')
        .replace(/∨/g, '\\lor').replace(/¬/g, '\\neg').replace(/⇒/g, '\\Rightarrow')
        .replace(/⇔/g, '\\Leftrightarrow').replace(/∠/g, '\\angle');
};

// [UPDATED] Hàm parseDocxContent đã được sửa để bắt đáp án có *
const parseDocxContent = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const elements = Array.from(doc.body.querySelectorAll('p, li, tr'));
    
    let currentPart = 1;
    const newQuestions = []; 
    let currentQ = null;

    const partRegex = /\[P([1-3])\]|PHẦN ([1-3])/i;
    const questionRegex = /^(Câu|Bài)\s+\d+[:.]?\s*(.*)/i; 
    
    // [FIX] Regex cho MCQ (A. B. C. D.) - Có thể có * ở đầu, dấu chấm hoặc ngoặc
    // Group 1: Dấu * (nếu có)
    // Group 2: Ký tự A-D
    // Group 3: Nội dung đáp án
    const answerRegex = /^\s*(\*?)\s*([A-D])\s*[:.)]\s*(.*)/i;
    
    // [FIX] Regex cho TF (a. b. c. d.) - Có thể có * ở đầu
    const tfItemRegex = /^\s*(\*?)\s*([a-d])\s*[:.)]\s*(.*)/i;

    const pushCurrentQ = () => {
        if (currentQ) {
            if (currentQ.type === 'MCQ') {
                while(currentQ.a.length < 4) currentQ.a.push("");
            }
            newQuestions.push(currentQ); 
            currentQ = null;
        }
    };

    elements.forEach(el => {
        let text = el.textContent.trim();
        text = sanitizeMathText(text);

        if (!text) return;

        const partMatch = text.match(partRegex);
        if (partMatch) { 
            pushCurrentQ(); 
            currentPart = parseInt(partMatch[1] || partMatch[2]); 
            return; 
        }

        const qMatch = text.match(questionRegex);
        if (qMatch) {
            pushCurrentQ(); 
            let qContent = qMatch[2];
            
            if (currentPart === 1) {
                currentQ = { id: Date.now() + Math.random(), type: 'MCQ', part: 1, q: qContent, a: [], aImages: [], correct: 0 };
            } else if (currentPart === 2) {
                currentQ = { id: Date.now() + Math.random(), type: 'TF', part: 2, q: qContent, items: [] };
            } else if (currentPart === 3) {
                currentQ = { id: Date.now() + Math.random(), type: 'SA', part: 3, q: qContent, correct: '' };
            }
            return;
        }

        if (currentQ) {
            if (currentQ.type === 'MCQ') {
                // Xử lý MCQ - Tách nhiều đáp án trên 1 dòng nếu có (VD: A. Táo  B. Cam)
                // Regex tìm [Dấu * tùy chọn] [A-D] [Dấu chấm/ngoặc]
                const parts = text.split(/(?:^|\s+)(\*?[A-D])\s*[:.)]\s+/i).filter(Boolean);
                
                if (parts.length >= 2 && /^\*?[A-D]$/i.test(parts[0])) {
                     // Nếu dòng có nhiều đáp án ngang
                     for (let i = 0; i < parts.length; i += 2) {
                         const label = parts[i]; // Ví dụ: "A" hoặc "*A"
                         const content = parts[i+1].trim();
                         
                         const hasStar = label.includes('*');
                         currentQ.a.push(content);
                         
                         // Check đúng: Có dấu * HOẶC in đậm/gạch chân HOẶC ký hiệu * trong text gốc
                         if (hasStar || el.innerHTML.includes('<b>') || el.innerHTML.includes('<u>') || text.includes('*')) {
                             currentQ.correct = currentQ.a.length - 1; 
                         }
                     }
                } else {
                    // Xử lý dòng đơn lẻ
                    const ansMatch = text.match(answerRegex);
                    if (ansMatch) {
                        const hasStar = !!ansMatch[1]; // Group 1 là dấu *
                        // const label = ansMatch[2];
                        const content = ansMatch[3];
                        
                        currentQ.a.push(content);
                        if (hasStar || el.innerHTML.includes('<b>') || el.innerHTML.includes('<u>') || text.includes('*')) {
                            currentQ.correct = currentQ.a.length - 1;
                        }
                    } else if (currentQ.a.length === 0) {
                        currentQ.q += " " + text;
                    }
                }
            } else if (currentQ.type === 'TF') {
                const itemMatch = text.match(tfItemRegex);
                if (itemMatch) {
                    const hasStar = !!itemMatch[1]; // Group 1 là dấu *
                    // const label = itemMatch[2];
                    const content = itemMatch[3];
                    
                    const html = el.innerHTML.toLowerCase();
                    // Đúng nếu: Có dấu * ở đầu HOẶC in đậm/gạch chân HOẶC có chữ "đúng"
                    const isTrue = hasStar || html.includes('<b>') || html.includes('<strong>') || html.includes('<u>') || text.toLowerCase().includes('đúng');
                    
                    currentQ.items.push({
                        text: content,
                        isTrue: isTrue,
                        img: ''
                    });
                } else if (currentQ.items.length === 0) {
                     currentQ.q += " " + text;
                }
            } else if (currentQ.type === 'SA') {
                if (text.toLowerCase().startsWith('key:') || text.toLowerCase().startsWith('đáp án:')) {
                    const ans = text.split(/[:]/).slice(1).join(':').trim();
                    currentQ.correct = ans;
                } else {
                     currentQ.q += " " + text;
                }
            }
        }
    });

    pushCurrentQ();
    return newQuestions;
};

  const handleGenerateAI = async () => {
    if (!aiTopic) return alert("Thầy chưa nhập chủ đề!");
    const countTN = parseInt(matrix.tn_biet) + parseInt(matrix.tn_hieu) + parseInt(matrix.tn_vd);
    const countDS = parseInt(matrix.ds_count);
    const countTL = parseInt(matrix.tl_biet) + parseInt(matrix.tl_hieu) + parseInt(matrix.tl_vd);
    if (countTN + countDS + countTL === 0) return alert("Vui lòng nhập số lượng câu hỏi!");
    setAiLoading(true);
    try {
       const userConfigDoc = await getDoc(doc(firestore, "user_configs", user.uid));
       if (!userConfigDoc.exists()) throw new Error("Chưa tìm thấy cấu hình API Key.");
       const config = userConfigDoc.data();
       const apiKey = config.geminiKey;
       const modelName = config.geminiModel || "gemini-1.5-flash"; 
       if (!apiKey) throw new Error("Chưa nhập API Key trong phần Cấu hình!");
       const dynamicGenAI = new GoogleGenerativeAI(apiKey);
       const model = dynamicGenAI.getGenerativeModel({ model: modelName });

      const prompt = `
        Đóng vai giáo viên môn ${aiSubject} lớp ${aiLevel}. Soạn đề thi chủ đề: "${aiTopic}".
        Tài liệu tham khảo: ${aiSource}
        - Câu trả lời không được chứa thông tin ngoài lề, chỉ tập trung vào việc tạo câu hỏi. Không chứa các đáp án dạng tất cả đều đúng/sai, A,B,C,D đều đúng/sai.
        - Lời dẫn không chứa các thông tin như theo sách, theo tài liệu, theo chương trình học, theo bộ giáo dục...
        - Bám sát giáo khoa và chuẩn kiến thức kỹ năng hiện hành của Việt Nam.
        CẤU TRÚC ĐỀ THI:
        - PHẦN 1 (Trắc nghiệm): Tổng ${countTN} câu (${matrix.tn_biet} Biết, ${matrix.tn_hieu} Hiểu, ${matrix.tn_vd} Vận dụng).
        - PHẦN 2 (Đúng/Sai): Tổng ${matrix.ds_count} câu lớn. Mỗi câu 4 ý (${matrix.ds_biet} Biết, ${matrix.ds_hieu} Hiểu, ${matrix.ds_vd} Vận dụng).
        - PHẦN 3 (Trả lời ngắn): Tổng ${countTL} câu (${matrix.tl_biet} Biết, ${matrix.tl_hieu} Hiểu, ${matrix.tl_vd} Vận dụng).
        
        QUY TẮC ĐỊNH DẠNG:
        1. CHỈ dùng dấu $...$ cho công thức phức tạp:Đạo hàm, Lũy thừa, căn bậc 2, bậc 3, chỉ số, phân số, tích phân, giới hạn, hàm lượng giác, ma trận, v.v. ví dụ: $x^2$, $\\frac{a}{b}$, $\\int_a^b f(x)dx$, $sqrt(x-4)$....
        2. KHÔNG dùng $...$ cho các biểu thức, toán tử đơn giản: cộng, trừ, nhân, chia, căn bậc hai, v.v. Ví dụ: 2 + 2 = 4, √5, a × b = ab.  
        3. Ký tự backslash (\\) trong LaTeX phải được escape thành (\\\\).
        4. Đáp câu hỏi ngắn(SA) là số tối đa 4 từ kể nếu dấu chấm, dấu âm. ví dụ: 5, -3, 12.5, -10.2, 2006
        5. Lời dẫn câu hỏi đúng/sai là 1 tình huống bám sát nội dung bài trong sgk và dài khoảng 3-4 dòng.
        
        OUTPUT JSON (Mảng duy nhất):
        [
            { "type": "MCQ", "part": 1, "q": "...", "a": ["A", "B", "C", "D"], "correct": 0 },
            { "type": "TF", "part": 2, "q": "...", "items": [ { "text": "...", "isTrue": true }, ... ] },
            { "type": "SA", "part": 3, "q": "...", "correct": "..." }
        ]`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiQuestions = JSON.parse(cleanText).map(q => ({
          ...q, id: Date.now() + Math.random(), aImages: [], a: q.a || ['', '', '', ''], correct: q.correct ?? '',
          items: q.type==='TF' ? q.items.map(i => ({...i, img: ''})) : null
      }));
      setQuestions([...questions, ...aiQuestions]);
      setShowAiModal(false);
      setMatrix({ tn_biet: 0, tn_hieu: 0, tn_vd: 0, ds_count: 0, ds_biet: 0, ds_hieu: 0, ds_vd: 0, tl_biet: 0, tl_hieu: 0, tl_vd: 0 });
      alert(`🎉 Đã tạo thành công ${aiQuestions.length} câu hỏi!`);
    } catch (error) { console.error(error); alert("Lỗi AI: " + error.message); } finally { setAiLoading(false); }
  };

  const addQuestion = (type) => {
    const newId = Date.now();
    let newQ = { id: newId, q: '', img: '' };
    if (type === 'MCQ') newQ = { ...newQ, type: 'MCQ', part: 1, a: ['', '', '', ''], aImages: ['', '', '', ''], correct: 0 };
    else if (type === 'TF') newQ = { ...newQ, type: 'TF', part: 2, items: [{ text: '', isTrue: false, img: '' }, { text: '', isTrue: false, img: '' }, { text: '', isTrue: false, img: '' }, { text: '', isTrue: false, img: '' }] };
    else if (type === 'SA') newQ = { ...newQ, type: 'SA', part: 3, correct: '' };
    setQuestions([...questions, newQ]);
  };
  const updateQuestion = (index, field, value) => { const newQs = [...questions]; newQs[index][field] = value; setQuestions(newQs); };
  const updateMCQAnswer = (qIndex, aIndex, value) => { const newQs = [...questions]; newQs[qIndex].a[aIndex] = value; setQuestions(newQs); };
  const updateTFItem = (qIndex, itemIndex, field, value) => { const newQs = [...questions]; newQs[qIndex].items[itemIndex][field] = value; setQuestions(newQs); };
  const removeQuestion = (index) => { if (confirm("Xóa câu hỏi này?")) setQuestions(questions.filter((_, i) => i !== index)); };

const handleOpenPreview = () => {
    if (!title.trim()) return alert("Vui lòng nhập tên bài thi để xem trước!");
    setShowFullPreview(true);
};

  const handleSave = async () => {
    if (!title.trim()) return alert("Vui lòng nhập tên bài thi!");
    if (!subject) return alert("Vui lòng chọn Môn học!");
    setLoading(true);
    
    const questionsForGame = questions.map(q => {
        const baseQ = {
            ...q,
            q: convertToMathML(q.q || ""), 
            a: q.type === 'MCQ' ? (q.a || []).map(ans => convertToMathML(ans || "")) : null,
            items: q.type === 'TF' ? (q.items || []).map(i => ({...i, text: convertToMathML(i.text || ""), img: i.img || null})) : null,
            correct: q.type === 'SA' ? convertToMathML(q.correct || "") : (q.correct || 0),
            img: q.img || null,
            aImages: q.aImages || null
        };
        if(q.type === 'TF') delete baseQ.a;
        if(q.type === 'SA') delete baseQ.a;
        return baseQ;
    });

    try {
      const quizData = { 
          title: title.trim(), 
          examCode: examCode || "", 
          grade: grade || "10", 
          subject: subject || "", 
          assignedClass: assignedClass || "", 
          duration: parseInt(duration) || 45, 
          scoreConfig: scoreConfig || { p1: 6, p3: 1 }, 
          authorId: user.uid, 
          questions: questionsForGame, 
          rawQuestions: questions,     
          status: 'OPEN',
          origin: origin,
          isPublic: origin === 'GAME_REPO' ? true : false 
      };
      
      const cleanData = JSON.parse(JSON.stringify(quizData));
      cleanData.updatedAt = serverTimestamp();
      if (!id) cleanData.createdAt = serverTimestamp();

      if (id) await updateDoc(doc(firestore, "quizzes", id), cleanData);
      else await addDoc(collection(firestore, "quizzes"), cleanData);
      
      alert("Lưu thành công!");
      router.push('/dashboard');
    } catch (e) { 
        console.error("Lỗi lưu:", e);
        alert("Lỗi lưu: " + e.message); 
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans text-slate-900">
      <input type="file" accept=".docx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept="image/*" ref={qImgRef} onChange={onFileChange} className="hidden" />
      <input type="file" accept="image/*" ref={aImgRef} onChange={onFileChange} className="hidden" />

      {/* MODAL AI */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
            <div className="bg-[#15803d] p-5 text-white flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2"><BrainCircuit /> AI SOẠN ĐỀ (MA TRẬN MỚI)</h2>
              <button onClick={() => setShowAiModal(false)}><X size={24}/></button>
            </div>
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-bold text-emerald-700 mb-1">Khối lớp:</label><select value={aiLevel} onChange={(e) => setAiLevel(e.target.value)} className="w-full border p-2.5 rounded-lg">{GRADE_OPTIONS.map(g => <option key={g} value={g}>Khối {g}</option>)}</select></div>
                    <div><label className="block text-sm font-bold text-emerald-700 mb-1">Môn học:</label><select value={aiSubject} onChange={(e) => setAiSubject(e.target.value)} className="w-full border p-2.5 rounded-lg">{SUBJECT_OPTIONS.map((sub, i) => <option key={i} value={sub}>{sub}</option>)}</select></div>
                </div>
                <div><label className="block text-sm font-bold text-emerald-700 mb-1">Chủ đề:</label><input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="VD: Hàm số..." className="w-full border p-2.5 rounded-lg outline-none focus:border-emerald-500" /></div>
                <div><label className="block text-sm font-bold text-emerald-700 mb-1 flex items-center gap-2">Nguồn tài liệu:</label><textarea value={aiSource} onChange={(e) => setAiSource(e.target.value)} placeholder="Dán nội dung..." className="w-full border p-2 rounded-lg h-16 text-sm outline-none focus:border-emerald-500"/></div>
                <div className="space-y-4">
                    <label className="block text-sm font-bold text-[#15803d] uppercase">Ma trận câu hỏi:</label>
                    <div className="bg-white p-3 rounded-lg border border-blue-500"><div className="text-blue-600 font-bold text-sm mb-2">P1: Trắc nghiệm</div><div className="grid grid-cols-3 gap-4"><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Biết</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-blue-700 font-bold" value={matrix.tn_biet} onChange={(e)=>setMatrix({...matrix, tn_biet: e.target.value})} /></div><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Hiểu</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-blue-700 font-bold" value={matrix.tn_hieu} onChange={(e)=>setMatrix({...matrix, tn_hieu: e.target.value})} /></div><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">V.Dụng</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-blue-700 font-bold" value={matrix.tn_vd} onChange={(e)=>setMatrix({...matrix, tn_vd: e.target.value})} /></div></div></div>
                    <div className="bg-white p-3 rounded-lg border border-red-500"><div className="flex items-center justify-between mb-2"><span className="text-red-600 font-bold text-sm">P2: Đúng / Sai</span><div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-700">Số câu lớn:</span><input type="number" min="0" className="w-16 border-2 border-red-200 p-1 rounded text-center font-black text-red-600" value={matrix.ds_count} onChange={(e)=>setMatrix({...matrix, ds_count: e.target.value})} /></div></div><div className="bg-red-50 p-2 rounded border border-red-100"><div className="text-[10px] text-red-500 font-bold mb-1 uppercase">Phân bổ ý con:</div><div className="grid grid-cols-3 gap-4"><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Ý Biết</span><input type="number" min="0" className="w-full border p-2 rounded text-center" value={matrix.ds_biet} onChange={(e)=>setMatrix({...matrix, ds_biet: e.target.value})} /></div><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Ý Hiểu</span><input type="number" min="0" className="w-full border p-2 rounded text-center" value={matrix.ds_hieu} onChange={(e)=>setMatrix({...matrix, ds_hieu: e.target.value})} /></div><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">V.Dụng</span><input type="number" min="0" className="w-full border p-2 rounded text-center" value={matrix.ds_vd} onChange={(e)=>setMatrix({...matrix, ds_vd: e.target.value})} /></div></div></div></div>
                    <div className="bg-white p-3 rounded-lg border border-green-500"><div className="text-green-700 font-bold text-sm mb-2">P3: Trả lời ngắn</div><div className="grid grid-cols-3 gap-4"><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Biết</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-green-700 font-bold" value={matrix.tl_biet} onChange={(e)=>setMatrix({...matrix, tl_biet: e.target.value})} /></div><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">Hiểu</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-green-700 font-bold" value={matrix.tl_hieu} onChange={(e)=>setMatrix({...matrix, tl_hieu: e.target.value})} /></div><div className="flex items-center gap-2"><span className="text-xs font-bold w-12">V.Dụng</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-green-700 font-bold" value={matrix.tl_vd} onChange={(e)=>setMatrix({...matrix, tl_vd: e.target.value})} /></div></div></div>
                </div>
                <button onClick={handleGenerateAI} disabled={aiLoading} className="w-full bg-[#15803d] py-3 text-white font-bold rounded-xl shadow-lg">{aiLoading ? <Loader2 className="animate-spin mx-auto"/> : "BẮT ĐẦU TẠO ĐỀ"}</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8 sticky top-0 bg-slate-50/95 backdrop-blur z-20 py-4 border-b border-slate-200">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-slate-900 font-bold"><ArrowLeft /> Quay lại</button>
        <div className="flex gap-3">
          <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold shadow transition"><Upload size={18} /> Upload Word</button>
          <button onClick={() => setShowAiModal(true)} className="flex items-center gap-2 bg-[#15803d] hover:bg-emerald-800 text-white px-4 py-2 rounded-lg font-bold shadow transition animate-pulse"><Sparkles size={18} /> AI Soạn Đề</button>
            <button onClick={handleOpenPreview} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold shadow transition"><Eye size={18} /> Xem trước đề</button>
          <button onClick={handleSave} disabled={loading || imgUploading} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition">{loading || imgUploading ? <Loader2 className="animate-spin"/> : <><Save size={18} /> Lưu Đề Thi</>}</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        {/* KHUNG THÔNG TIN CHUNG */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-slate-700 flex items-center gap-2 uppercase text-sm"><Info size={18} /> Thông tin chung</h3>
              {origin === 'GAME_REPO' && <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-bold">ĐANG TẠO CHO KHO GAME</span>}
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                  <Hash size={14} className="text-indigo-500"/>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mã đề:</span>
                  <span className="font-black text-indigo-700 text-lg">{examCode}</span>
                  <button onClick={() => setExamCode(generateExamCode())} className="p-1 hover:bg-white rounded transition" title="Tạo lại mã"><RefreshCcw size={12} className="text-blue-500"/></button>
              </div>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-3xl font-black border-b-2 border-slate-100 focus:border-indigo-500 outline-none py-2 mb-8 placeholder-slate-200" placeholder="Tên bài kiểm tra..." />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><GraduationCap size={12}/> Khối lớp</label><select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl p-2.5 font-bold outline-none focus:border-indigo-500 bg-white">{GRADE_OPTIONS.map(g => <option key={g} value={g}>Khối {g}</option>)}</select></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><Book size={12}/> Môn học</label><select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl p-2.5 font-bold outline-none focus:border-indigo-500 bg-white"><option value="">-- Chọn môn --</option>{SUBJECT_OPTIONS.map((sub, i) => <option key={i} value={sub}>{sub}</option>)}</select></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><Users size={12}/> Lớp áp dụng</label><input value={assignedClass} onChange={(e) => setAssignedClass(e.target.value)} placeholder="VD: 10A1, 10A2" className="w-full border-2 border-slate-100 rounded-xl p-2.5 font-bold focus:border-indigo-500 outline-none" /></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><Clock size={12}/> Thời gian (Phút)</label><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl p-2.5 font-bold focus:border-indigo-500 outline-none text-center" /></div>
          </div>
        </div>

        {/* CẤU HÌNH ĐIỂM */}
        <div className="bg-gradient-to-r from-slate-50 to-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <h3 className="font-black text-slate-700 flex items-center gap-2 mb-4 uppercase text-sm"><Calculator size={18} /> Cấu trúc điểm ({scoreStats.totalScore} điểm)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100"><div className="flex justify-between items-center mb-2"><span className="text-blue-700 font-bold text-sm">P1: Trắc nghiệm</span><span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{scoreStats.p1Count} câu</span></div><div className="flex items-center gap-2"><input type="number" min="0" step="0.5" className="w-full border-2 border-blue-200 rounded-lg p-2 font-bold text-blue-900 text-center focus:border-blue-500 outline-none" value={scoreConfig.p1} onChange={(e) => setScoreConfig({...scoreConfig, p1: e.target.value})} /><span className="text-xs font-bold text-blue-400 whitespace-nowrap">Tổng điểm</span></div><div className="mt-2 text-xs text-blue-500 text-center font-medium">~ {scoreStats.p1PerQ} đ/câu</div></div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 opacity-80"><div className="flex justify-between items-center mb-2"><span className="text-red-700 font-bold text-sm">P2: Đúng/Sai</span><span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full font-bold">{scoreStats.p2Count} câu lớn</span></div><div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-red-100 justify-center"><span className="text-red-500 font-bold text-sm">Theo quy tắc GDPT</span><Info size={14} className="text-red-300"/></div></div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100"><div className="flex justify-between items-center mb-2"><span className="text-green-700 font-bold text-sm">P3: Trả lời ngắn</span><span className="bg-green-200 text-green-800 text-xs px-2 py-1 rounded-full font-bold">{scoreStats.p3Count} câu</span></div><div className="flex items-center gap-2"><input type="number" min="0" step="0.5" className="w-full border-2 border-green-200 rounded-lg p-2 font-bold text-green-900 text-center focus:border-green-500 outline-none" value={scoreConfig.p3} onChange={(e) => setScoreConfig({...scoreConfig, p3: e.target.value})} /><span className="text-xs font-bold text-green-400 whitespace-nowrap">Tổng điểm</span></div><div className="mt-2 text-xs text-green-500 text-center font-medium">~ {scoreStats.p3PerQ} đ/câu</div></div>
            </div>
        </div>

        {/* DANH SÁCH CÂU HỎI */}
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 group transition-shadow hover:shadow-md">
            <div className="flex justify-between items-center">
              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-white ${q.type==='MCQ'?'bg-blue-500':q.type==='TF'?'bg-red-500':'bg-green-500'}`}>Câu {qIndex + 1} - {q.type}</span>
              <button onClick={() => removeQuestion(qIndex)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
            </div>

            {/* Ô NHẬP CÂU HỎI */}
            <div className="space-y-2">
                <div className="flex gap-2">
                    <textarea 
                        value={q.q} 
                        onChange={(e) => updateQuestion(qIndex, 'q', e.target.value)} 
                        onPaste={(e) => handlePaste(e, qIndex, 'QUESTION')}
                        rows={3} 
                        className="w-full border-2 border-slate-100 rounded-xl p-4 font-bold text-lg focus:border-indigo-500 outline-none bg-slate-50 transition-all" 
                        placeholder="Gõ nội dung hoặc dùng [img] để chèn ảnh. (Paste ảnh để upload nhanh)..." 
                    />
                    <button onClick={() => triggerUpload(qIndex, -1, 'QUESTION')} className="p-3 bg-slate-100 hover:bg-indigo-100 rounded-xl transition text-slate-500 hover:text-indigo-600" title="Thêm ảnh"><ImageIcon size={24}/></button>
                </div>
                {/* PREVIEW TOÁN VÀ ẢNH INLINE */}
                {q.q && (
                    <details className="mt-2 group" open={q.q.includes('$') || q.q.includes('[img]')}>
                        <summary className="list-none text-xs font-bold text-indigo-500 cursor-pointer flex items-center gap-1 select-none"><Eye size={14}/> Xem trước nội dung</summary>
                        <div className="mt-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-lg font-bold">
                            {renderWithInlineImage(q.q, q.img)}
                        </div>
                    </details>
                )}
                {/* Chỉ hiện ảnh thumbnail nếu KHÔNG dùng [img] */}
                {q.img && !q.q.includes('[img]') && <div className="relative inline-block mt-2"><img src={q.img} className="max-h-48 rounded-lg shadow-lg border border-slate-200"/><button onClick={()=>updateQuestion(qIndex, 'img', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"><X size={12}/></button></div>}
            </div>

            {/* MCQ Answers */}
            {q.type === 'MCQ' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.a.map((ans, aIdx) => (
                        <div key={aIdx} className={`p-4 border-2 rounded-2xl transition-all shadow-sm ${q.correct === aIdx ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-white hover:border-blue-300'}`}>
                            <div className="flex gap-3 items-center mb-2">
                                <div onClick={()=>updateQuestion(qIndex, 'correct', aIdx)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${q.correct===aIdx?'bg-green-500 border-green-500 text-white':'bg-white border-slate-200 text-slate-300'}`}>{String.fromCharCode(65+aIdx)}</div>
                                <input 
                                    value={ans} 
                                    onChange={(e)=>updateMCQAnswer(qIndex, aIdx, e.target.value)} 
                                    onPaste={(e) => handlePaste(e, qIndex, 'ANSWER', aIdx)}
                                    className="flex-1 bg-transparent outline-none font-bold text-lg" 
                                    placeholder="Đáp án... (Dùng [img] để chèn ảnh)" 
                                />
                                <button onClick={() => triggerUpload(qIndex, aIdx, 'ANSWER')} className="text-slate-300 hover:text-blue-500 transition-colors"><ImageIcon size={18}/></button>
                            </div>
                            {ans && (
                                <details className="mt-1"><summary className="list-none text-[10px] text-blue-400 cursor-pointer select-none">Xem trước</summary>
                                    <div className="text-sm font-medium">{renderWithInlineImage(ans, q.aImages?.[aIdx])}</div>
                                </details>
                            )}
                            {q.aImages?.[aIdx] && !ans.includes('[img]') && <div className="relative mt-2 inline-block"><img src={q.aImages[aIdx]} className="h-20 rounded border object-contain"/><button onClick={()=>{const n=[...q.aImages]; n[aIdx]=''; updateQuestion(qIndex, 'aImages', n)}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow"><X size={10}/></button></div>}
                        </div>
                    ))}
                </div>
            )}

            {/* Đúng/Sai Answers */}
            {q.type === 'TF' && (
                <div className="space-y-1 border rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100 p-3 text-[10px] font-black text-slate-500 grid grid-cols-12 gap-2 uppercase tracking-wider"><div className="col-span-8 pl-4">Nội dung ý con</div><div className="col-span-2 text-center">Đúng</div><div className="col-span-2 text-center">Sai</div></div>
                    {q.items.map((item, iIdx) => (
                        <div key={iIdx} className="p-3 border-t bg-white grid grid-cols-12 gap-2 items-center hover:bg-slate-50">
                            <div className="col-span-8 space-y-2 pl-4">
                                <div className="flex items-center gap-2">
                                    <input 
                                        value={item.text} 
                                        onChange={(e)=>updateTFItem(qIndex, iIdx, 'text', e.target.value)}
                                        onPaste={(e) => handlePaste(e, qIndex, 'TF_ITEM', iIdx)} 
                                        className="w-full bg-transparent outline-none font-bold text-lg" 
                                        placeholder="Nhập nội dung... (Dùng [img] để chèn ảnh)" 
                                    />
                                     <button onClick={() => triggerUpload(qIndex, iIdx, 'TF_ITEM')} className="text-slate-300 hover:text-blue-500 transition-colors"><ImageIcon size={18}/></button>
                                </div>
                                {/* Hiển thị ảnh thumbnail nếu KHÔNG có [img] */}
                                {item.img && !item.text.includes('[img]') && (
                                    <div className="relative inline-block">
                                        <img src={item.img} className="h-16 rounded border object-contain" />
                                        <button onClick={() => updateTFItem(qIndex, iIdx, 'img', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow"><X size={10}/></button>
                                    </div>
                                )}
                                {item.text && (
                                    <details><summary className="list-none text-[10px] text-blue-400 cursor-pointer">Xem trước</summary>
                                        <div className="text-sm">{renderWithInlineImage(item.text, item.img)}</div>
                                    </details>
                                )}
                            </div>
                            <div className="col-span-2 flex justify-center"><button onClick={() => updateTFItem(qIndex, iIdx, 'isTrue', true)} className={`w-10 h-10 rounded-xl border-2 font-black transition-all ${item.isTrue === true ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-200' : 'bg-white border-slate-100 text-slate-200 hover:border-green-200'}`}>Đ</button></div>
                            <div className="col-span-2 flex justify-center"><button onClick={() => updateTFItem(qIndex, iIdx, 'isTrue', false)} className={`w-10 h-10 rounded-xl border-2 font-black transition-all ${item.isTrue === false ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200' : 'bg-white border-slate-100 text-slate-200 hover:border-red-200'}`}>S</button></div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trả lời ngắn */}
            {q.type === 'SA' && (
                <div className="bg-green-50 p-6 rounded-2xl border border-green-100 shadow-inner">
                    <label className="block text-[10px] font-black text-green-700 uppercase mb-3 tracking-widest">Đáp án chính xác (Học sinh phải gõ khớp):</label>
                    <input 
                        value={q.correct} 
                        onChange={(e) => updateQuestion(qIndex, 'correct', e.target.value)} 
                        className="w-full border-2 border-green-200 p-4 rounded-xl focus:border-green-500 outline-none font-black text-xl text-green-900 bg-white shadow-sm" 
                        placeholder="..." 
                    />
                    {q.correct && q.correct.includes('$') && (
                        <details className="mt-2"><summary className="list-none text-xs text-green-600 cursor-pointer">Xem trước công thức</summary><div className="mt-1 p-3 bg-white/50 rounded-lg"><MathRender content={q.correct} className="text-lg font-bold" /></div></details>
                    )}
                </div>
            )}
          </div>
        ))}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sticky bottom-6">
            <button onClick={() => addQuestion('MCQ')} className="py-4 bg-white border-2 border-dashed border-blue-300 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 shadow-sm"><List size={20}/> Thêm Trắc Nghiệm (P1)</button>
            <button onClick={() => addQuestion('TF')} className="py-4 bg-white border-2 border-dashed border-red-300 text-red-600 rounded-xl font-bold hover:bg-red-50 transition flex items-center justify-center gap-2 shadow-sm"><CheckSquare size={20}/> Thêm Đúng/Sai (P2)</button>
            <button onClick={() => addQuestion('SA')} className="py-4 bg-white border-2 border-dashed border-green-300 text-green-600 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 shadow-sm"><Type size={20}/> Thêm Trả Lời Ngắn (P3)</button>
        </div>
      </main>
{showFullPreview && (
  <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
      <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
        <h2 className="font-black text-slate-700 uppercase">Xem trước đề thi</h2>
        <button onClick={() => setShowFullPreview(false)} className="p-1 hover:bg-slate-200 rounded-full transition"><X size={24} className="text-slate-400" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 text-slate-800" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold uppercase mb-1">{title || "TÊN BÀI KIỂM TRA"}</h1>
          <p className="font-medium">Môn: {subject || "..."} | Khối: {grade} | Thời gian: {duration} phút</p>
          <div className="w-20 h-0.5 bg-black mx-auto mt-2"></div>
        </div>

        <div className="space-y-10">
          {questions.length > 0 ? (
            questions.map((q, idx) => (
              <div key={q.id || idx} className="space-y-3">
                <div className="flex gap-2 items-start">
                  <span className="font-bold whitespace-nowrap">Câu {idx + 1}:</span>
                  <div className="inline-block leading-relaxed">
                      {/* [NEW] Hiển thị Inline Image */}
                      {renderWithInlineImage(q.q, q.img)}
                  </div>
                </div>
                {/* [NEW] Chỉ hiển thị ảnh Block nếu KHÔNG dùng thẻ [img] trong text */}
                {q.img && !q.q.includes('[img]') && (
                    <div className="my-2"><img src={q.img} alt="Question" className="max-h-64 rounded-lg border shadow-sm mx-auto" /></div>
                )}

                {q.type === 'MCQ' && q.a && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-6">
                    {q.a.map((ans, aIdx) => (
                      <div key={aIdx} className="flex gap-2 items-start">
                        <span className="font-bold">{String.fromCharCode(65 + aIdx)}.</span>
                        <div className="flex flex-col">
                            {/* [NEW] Render Inline Image cho đáp án */}
                            {renderWithInlineImage(ans, q.aImages?.[aIdx])}
                            {/* Fallback ảnh block cũ */}
                            {q.aImages && q.aImages[aIdx] && !ans.includes('[img]') && (
                                <img src={q.aImages[aIdx]} className="max-h-32 mt-1 rounded border object-contain"/>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'TF' && q.items && (
                  <div className="pl-6 space-y-2">
                    {q.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex gap-3 items-start italic border-b border-dashed pb-2 last:border-0">
                        <span className="min-w-[25px]">{String.fromCharCode(97 + iIdx)})</span>
                        <div className="flex-1">
                             {/* [NEW] Render Inline Image cho TF */}
                             {renderWithInlineImage(item.text, item.img)}
                             {item.img && !item.text.includes('[img]') && <img src={item.img} className="max-h-32 mt-1 rounded border object-contain block"/>}
                        </div>
                        <span className="text-xs text-slate-400 font-bold ml-auto">[{item.isTrue ? "Đúng" : "Sai"}]</span>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'SA' && <div className="pl-6 italic text-slate-500">(Học sinh trả lời ngắn vào ô trống)</div>}
              </div>
            ))
          ) : (<div className="text-center py-10 text-slate-400">Chưa có câu hỏi nào để hiển thị.</div>)}
        </div>
      </div>
      <div className="p-4 border-t bg-slate-50 flex justify-end rounded-b-2xl">
         <button onClick={() => setShowFullPreview(false)} className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg">ĐÓNG XEM TRƯỚC</button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}