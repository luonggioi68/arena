import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { auth, firestore } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
    Plus, Trash2, Save, ArrowLeft, CheckCircle, Sparkles, X, Loader2, List, 
    CheckSquare, Type, BrainCircuit, Upload, BookOpen, Image as ImageIcon, 
    Users, Calculator, Info, Clock, Hash, GraduationCap, Book, RefreshCcw, Eye, Atom, FileText,
    Download
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
  const fileInputSTEMRef = useRef(null); 
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

  const processMammothImage = async (image) => {
    try {
        const base64 = await image.read("base64");
        const type = image.contentType;
        const dataUri = `data:${type};base64,${base64}`;

        const formData = new FormData();
        formData.append("file", dataUri);
        formData.append("upload_preset", UPLOAD_PRESET);

        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        
        if (!res.ok) {
            const errorData = await res.json();
            console.error("Cloudinary Error:", errorData);
            return null;
        }
        
        const data = await res.json();
        return { src: data.secure_url, class: "mammoth-uploaded-img" };
    } catch (error) {
        console.error("Lỗi upload ảnh:", error);
        return null; 
    }
  };

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

  const parseDocxContent = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const elements = Array.from(doc.body.querySelectorAll('p, li, tr'));
    
    let currentPart = 1;
    const newQuestions = []; 
    let currentQ = null;

    const partRegex = /\[P([1-3])\]|PHẦN ([1-3])/i;
    const questionRegex = /^(Câu|Bài)\s+\d+[:.]?\s*(.*)/i; 
    const answerRegex = /^\s*(\*?)\s*([A-D])\s*[:.)]\s*(.*)/i;
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
            
            const imgEl = el.querySelector('img');
            let imgSrc = '';
            if (imgEl) imgSrc = imgEl.src;

            if (currentPart === 1) {
                currentQ = { id: Date.now() + Math.random(), type: 'MCQ', part: 1, q: qContent, img: imgSrc, a: [], aImages: [], correct: 0 };
            } else if (currentPart === 2) {
                currentQ = { id: Date.now() + Math.random(), type: 'TF', part: 2, q: qContent, img: imgSrc, items: [] };
            } else if (currentPart === 3) {
                currentQ = { id: Date.now() + Math.random(), type: 'SA', part: 3, q: qContent, img: imgSrc, correct: '' };
            }
            return;
        }

        if (currentQ) {
            if (currentQ.type === 'MCQ') {
                const parts = text.split(/(?:^|\s+)(\*?[A-D])\s*[:.)]\s+/i).filter(Boolean);
                
                if (parts.length >= 2 && /^\*?[A-D]$/i.test(parts[0])) {
                     for (let i = 0; i < parts.length; i += 2) {
                         const label = parts[i]; 
                         const content = parts[i+1].trim();
                         const hasStar = label.includes('*');
                         currentQ.a.push(content);
                         if (hasStar || el.innerHTML.includes('<b>') || el.innerHTML.includes('<u>') || text.includes('*')) {
                             currentQ.correct = currentQ.a.length - 1; 
                         }
                     }
                } else {
                    const ansMatch = text.match(answerRegex);
                    if (ansMatch) {
                        const hasStar = !!ansMatch[1]; 
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
                    const hasStar = !!itemMatch[1]; 
                    const content = itemMatch[3];
                    const html = el.innerHTML.toLowerCase();
                    const isTrue = hasStar || html.includes('<b>') || html.includes('<strong>') || html.includes('<u>') || text.toLowerCase().includes('đúng');
                    
                    currentQ.items.push({ text: content, isTrue: isTrue, img: '' });
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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const options = { convertImage: mammoth.images.imgElement(processMammothImage) };
        const result = await mammoth.convertToHtml({ arrayBuffer: e.target.result }, options);
        const parsedQuestions = parseDocxContent(result.value);
        
        if (parsedQuestions.length > 0) {
            setQuestions(prev => [...prev, ...parsedQuestions]);
            alert(`✅ Đã nhập thành công ${parsedQuestions.length} câu hỏi (Cơ bản)!`);
        } else {
            alert("⚠️ Không tìm thấy câu hỏi.");
        }
      } catch (error) { 
          console.error(error); 
          alert("Lỗi đọc file Word: " + error.message); 
      } finally {
          setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null; 
  };

  const handleFileUploadSTEM = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const options = { convertImage: mammoth.images.imgElement(processMammothImage) };
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer }, options);
        let rawHtml = result.value; 

        const userConfigDoc = await getDoc(doc(firestore, "user_configs", user.uid));
        if (!userConfigDoc.exists()) throw new Error("Chưa nhập API Key Gemini trong Cấu hình!");
        
        const config = userConfigDoc.data();
        const genAI = new GoogleGenerativeAI(config.geminiKey);
        const model = genAI.getGenerativeModel({ model: config.geminiModel || "gemini-1.5-flash" });

        const prompt = `Bạn là chuyên gia xử lý dữ liệu đề thi. Hãy chuyển đổi HTML thô sau đây thành JSON. HTML ĐẦU VÀO: """${rawHtml}""" YÊU CẦU: 1. Toán: Chuyển công thức thành LaTeX $...$. 2. Ảnh: Giữ thẻ <img src="..."> và thay bằng " [img] ". Lấy link ảnh vào trường dữ liệu. 3. Phân loại: [P1] MCQ (4 đáp án A-D), [P2] TF (4 ý a-d), [P3] SA (Key). OUTPUT JSON: [ { "type": "MCQ", "part": 1, "q": "...", "img": "...", "a": ["A", "B", "C", "D"], "aImages": [], "correct": 0 }, { "type": "TF", "part": 2, "q": "...", "items": [{"text": "...", "isTrue": true}, ...] }, { "type": "SA", "part": 3, "q": "...", "correct": "..." } ]`;

        const aiResponse = await model.generateContent(prompt);
        const text = aiResponse.response.text();
        let cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        cleanJson = cleanJson.replace(/\\\\/g, '\\').replace(/\\/g, '\\\\').replace(/\\\\"/g, '\\"');

        const parsedQuestions = JSON.parse(cleanJson);
        const finalQuestions = parsedQuestions.map(q => ({
            id: Date.now() + Math.random(),
            type: q.type || 'MCQ', part: q.part || 1, q: (q.q || '').replace(/^(Câu|Bài)\s+\d+[:.]?\s*/i, '').trim(),
            img: q.img || '', a: Array.isArray(q.a) ? q.a : ['', '', '', ''], aImages: Array.isArray(q.aImages) ? q.aImages : ['', '', '', ''], 
            correct: q.correct !== undefined ? q.correct : 0, items: q.type === 'TF' ? (q.items || []).map(i => ({...i, img: i.img || ''})) : null
        }));

        setQuestions(prev => [...prev, ...finalQuestions]);
        alert(`✅ AI Đã nhập thành công ${finalQuestions.length} câu hỏi (STEM)!`);
    } catch (error) { console.error("Lỗi AI:", error); alert(`❌ Lỗi xử lý AI: ${error.message}`); } finally { setLoading(false); event.target.value = null; }
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

      const prompt = `Đóng vai giáo viên môn ${aiSubject} lớp ${aiLevel}. Soạn đề thi chủ đề: "${aiTopic}". Tài liệu tham khảo: ${aiSource}. 
      TUYỆT ĐỐI ĐÁP ÁN KHÔNG ĐƯỢC XUẤT RA CÂU TRẢ LỜI DẠNG TẤT CẢ ĐỀU ĐÚNG, A VÀ B ĐỀU ĐÚNG, HOẶC A VÀ B ĐỀU SAI. Mỗi câu hỏi phải có một đáp án đúng duy nhất. CẤU TRÚC ĐỀ THI: - PHẦN 1 (Trắc nghiệm): Tổng ${countTN} câu (${matrix.tn_biet} Biết, ${matrix.tn_hieu} Hiểu, ${matrix.tn_vd} Vận dụng). - PHẦN 2 (Đúng/Sai): Tổng ${matrix.ds_count} câu lớn. Mỗi câu BẮT BUỘC CÓ 4 ý con (${matrix.ds_biet} Biết, ${matrix.ds_hieu} Hiểu, ${matrix.ds_vd} Vận dụng). - PHẦN 3 (Trả lời ngắn): Tổng ${countTL} câu (${matrix.tl_biet} Biết, ${matrix.tl_hieu} Hiểu, ${matrix.tl_vd} Vận dụng). 
      YÊU CẦU BẮT BUỘC:
        1. Tuyệt đối KHÔNG chào hỏi, KHÔNG giải thích thêm. Chỉ in ra chuỗi JSON.
        2. Phân loại cách gõ Toán học:
           - Biểu thức phức tạp (phân số, căn, hệ phương trình...): BẮT BUỘC dùng mã LaTeX và kẹp trong dấu $...$ (Ví dụ: $\\frac{1}{2}$).
           - Biểu thức đơn giản (số, biến x y, pt bậc nhất...): KHÔNG CẦN kẹp dấu $.
        3. QUY TẮC SỐNG CÒN KHI KHÔNG DÙNG DẤU $: Nếu biểu thức không kẹp $, TUYỆT ĐỐI KHÔNG ĐƯỢC chứa các mã lệnh LaTeX (như \\le, \\ge, \\ne, \\alpha). Bắt buộc phải dùng các ký tự Toán học thông thường (Ví dụ: gõ thẳng ký tự "≤" thay vì "\\le", "≥" thay vì "\\ge", "≠" thay vì "\\ne").
        4. Ký tự backslash (\\) trong LaTeX phải được nhân đôi để escape thành (\\\\). (Ví dụ: "\\\\frac" thay vì "\\frac").
        5. ĐỐI VỚI CÂU ĐÚNG/SAI (TF), BẮT BUỘC PHẢI CÓ MẢNG "items" chứa 4 ý.
      OUTPUT CHỈ LÀ 1 MẢNG JSON CÓ CẤU TRÚC NHƯ SAU: [ { "type": "MCQ", "part": 1, "q": "...", "a": ["A", "B", "C", "D"], "correct": 0 }, { "type": "TF", "part": 2, "q": "...", "items": [ { "text": "...", "isTrue": true }, { "text": "...", "isTrue": false }, { "text": "...", "isTrue": true }, { "text": "...", "isTrue": false } ] }, { "type": "SA", "part": 3, "q": "...", "correct": "..." } ]`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("AI không trả về đúng định dạng JSON.");
      let cleanText = jsonMatch[0];

      cleanText = cleanText.replace(/\\\\/g, '\\').replace(/\\/g, '\\\\').replace(/\\\\"/g, '\\"');

      const aiQuestions = JSON.parse(cleanText).map(q => ({
          ...q, id: Date.now() + Math.random(), aImages: [], a: Array.isArray(q.a) ? q.a : ['', '', '', ''], correct: q.correct ?? '', items: q.type === 'TF' ? (q.items || []).map(i => ({...i, img: ''})) : null
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
          title: title.trim(), examCode: examCode || "", grade: grade || "10", subject: subject || "", assignedClass: assignedClass || "", duration: parseInt(duration) || 45, scoreConfig: scoreConfig || { p1: 6, p3: 1 }, authorId: user.uid, questions: questionsForGame, rawQuestions: questions, status: 'OPEN', origin: origin, isPublic: origin === 'GAME_REPO' ? true : false 
      };
      
      const cleanData = JSON.parse(JSON.stringify(quizData));
      cleanData.updatedAt = serverTimestamp();
      if (!id) cleanData.createdAt = serverTimestamp();

      if (id) await updateDoc(doc(firestore, "quizzes", id), cleanData);
      else await addDoc(collection(firestore, "quizzes"), cleanData);
      
      alert("Lưu thành công!");
      router.push('/dashboard');
    } catch (e) { console.error("Lỗi lưu:", e); alert("Lỗi lưu: " + e.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 pb-32 font-sans text-slate-900">
      <input type="file" accept=".docx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept=".docx" ref={fileInputSTEMRef} onChange={handleFileUploadSTEM} className="hidden" />
      <input type="file" accept="image/*" ref={qImgRef} onChange={onFileChange} className="hidden" />
      <input type="file" accept="image/*" ref={aImgRef} onChange={onFileChange} className="hidden" />

      {/* MODAL AI */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 relative">
             <div className="flex justify-between items-center sticky top-0 bg-white z-10 pb-2 border-b">
                 <h2 className="text-lg md:text-xl font-bold">AI SOẠN ĐỀ</h2>
                 <button onClick={()=>setShowAiModal(false)} className="hover:bg-slate-100 p-1 rounded-full transition"><X/></button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-emerald-700 mb-1">Khối lớp:</label><select value={aiLevel} onChange={(e) => setAiLevel(e.target.value)} className="w-full border p-2.5 rounded-lg">{GRADE_OPTIONS.map(g => <option key={g} value={g}>Khối {g}</option>)}</select></div>
                <div><label className="block text-sm font-bold text-emerald-700 mb-1">Môn học:</label><select value={aiSubject} onChange={(e) => setAiSubject(e.target.value)} className="w-full border p-2.5 rounded-lg">{SUBJECT_OPTIONS.map((sub, i) => <option key={i} value={sub}>{sub}</option>)}</select></div>
             </div>
             <div><label className="block text-sm font-bold text-emerald-700 mb-1">Chủ đề:</label><input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="VD: Hàm số..." className="w-full border p-2.5 rounded-lg outline-none focus:border-emerald-500" /></div>
             <div><label className="block text-sm font-bold text-emerald-700 mb-1 flex items-center gap-2">Nguồn tài liệu:</label><textarea value={aiSource} onChange={(e) => setAiSource(e.target.value)} placeholder="Dán nội dung..." className="w-full border p-2 rounded-lg h-16 text-sm outline-none focus:border-emerald-500"/></div>
             
             <div className="space-y-4">
                <label className="block text-sm font-bold text-[#15803d] uppercase">Ma trận câu hỏi:</label>
                <div className="bg-white p-3 rounded-lg border border-blue-500"><div className="text-blue-600 font-bold text-sm mb-2">P1: Trắc nghiệm</div><div className="grid grid-cols-3 gap-2 md:gap-4"><div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2"><span className="text-xs font-bold w-12 text-center md:text-left">Biết</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-blue-700 font-bold" value={matrix.tn_biet} onChange={(e)=>setMatrix({...matrix, tn_biet: e.target.value})} /></div><div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2"><span className="text-xs font-bold w-12 text-center md:text-left">Hiểu</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-blue-700 font-bold" value={matrix.tn_hieu} onChange={(e)=>setMatrix({...matrix, tn_hieu: e.target.value})} /></div><div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2"><span className="text-xs font-bold w-12 text-center md:text-left">V.Dụng</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-blue-700 font-bold" value={matrix.tn_vd} onChange={(e)=>setMatrix({...matrix, tn_vd: e.target.value})} /></div></div></div>
                <div className="bg-white p-3 rounded-lg border border-red-500"><div className="flex items-center justify-between mb-2"><span className="text-red-600 font-bold text-sm">P2: Đúng / Sai</span><div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-700">Số câu lớn:</span><input type="number" min="0" className="w-16 border-2 border-red-200 p-1 rounded text-center font-black text-red-600" value={matrix.ds_count} onChange={(e)=>setMatrix({...matrix, ds_count: e.target.value})} /></div></div><div className="bg-red-50 p-2 rounded border border-red-100"><div className="text-[10px] text-red-500 font-bold mb-1 uppercase">Phân bổ ý con:</div><div className="grid grid-cols-3 gap-2 md:gap-4"><div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2"><span className="text-xs font-bold w-12 text-center md:text-left">Biết</span><input type="number" min="0" className="w-full border p-2 rounded text-center" value={matrix.ds_biet} onChange={(e)=>setMatrix({...matrix, ds_biet: e.target.value})} /></div><div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2"><span className="text-xs font-bold w-12 text-center md:text-left">Hiểu</span><input type="number" min="0" className="w-full border p-2 rounded text-center" value={matrix.ds_hieu} onChange={(e)=>setMatrix({...matrix, ds_hieu: e.target.value})} /></div><div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2"><span className="text-xs font-bold w-12 text-center md:text-left">V.Dụng</span><input type="number" min="0" className="w-full border p-2 rounded text-center" value={matrix.ds_vd} onChange={(e)=>setMatrix({...matrix, ds_vd: e.target.value})} /></div></div></div></div>
                <div className="bg-white p-3 rounded-lg border border-green-500"><div className="text-green-700 font-bold text-sm mb-2">P3: Trả lời ngắn</div><div className="grid grid-cols-3 gap-2 md:gap-4"><div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2"><span className="text-xs font-bold w-12 text-center md:text-left">Biết</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-green-700 font-bold" value={matrix.tl_biet} onChange={(e)=>setMatrix({...matrix, tl_biet: e.target.value})} /></div><div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2"><span className="text-xs font-bold w-12 text-center md:text-left">Hiểu</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-green-700 font-bold" value={matrix.tl_hieu} onChange={(e)=>setMatrix({...matrix, tl_hieu: e.target.value})} /></div><div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2"><span className="text-xs font-bold w-12 text-center md:text-left">V.Dụng</span><input type="number" min="0" className="w-full border p-2 rounded text-center text-green-700 font-bold" value={matrix.tl_vd} onChange={(e)=>setMatrix({...matrix, tl_vd: e.target.value})} /></div></div></div>
             </div>
             
             <div className="sticky bottom-0 bg-white pt-2">
                 <button onClick={handleGenerateAI} disabled={aiLoading} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition">{aiLoading?<Loader2 className="animate-spin mx-auto"/>:"BẮT ĐẦU"}</button>
             </div>
          </div>
        </div>
      )}

      {/* HEADER TỐI ƯU MOBILE */}
      <header className="max-w-6xl mx-auto flex flex-col gap-3 mb-6 md:mb-8 sticky top-0 bg-slate-50/95 backdrop-blur z-20 py-3 md:py-4 border-b border-slate-200">
        
        {/* Hàng 1: Nút Quay Lại và Nút Lưu (Luôn hiện trên mobile) */}
        <div className="flex justify-between items-center">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-slate-900 font-bold shrink-0"><ArrowLeft /> <span className="hidden md:inline">Quay lại</span></button>
            <button onClick={handleSave} disabled={loading || imgUploading} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition shrink-0">
                {loading || imgUploading ? <Loader2 className="animate-spin"/> : <><Save size={18} /> Lưu</>}
            </button>
        </div>

        {/* Hàng 2: Các công cụ (Vuốt ngang trên Mobile) */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar items-center">
            <a href="/mauuploadde.docx" download className="shrink-0 flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200"><Download size={16}/> Mẫu</a>
            <button onClick={() => fileInputRef.current.click()} className="shrink-0 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold shadow transition text-sm"><Upload size={16} /> Up Word(XH)</button>
            <button onClick={() => fileInputSTEMRef.current.click()} className="shrink-0 flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold shadow transition animate-pulse text-sm"><Atom size={16} /> Up AI(Toán,Lý,Hóa)</button>
            <button onClick={() => setShowAiModal(true)} className="shrink-0 flex items-center gap-2 bg-[#15803d] hover:bg-emerald-800 text-white px-4 py-2 rounded-lg font-bold shadow transition animate-pulse text-sm"><Sparkles size={16} /> AI Soạn Đề</button>
            <button onClick={handleOpenPreview} className="shrink-0 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold shadow transition text-sm"><Eye size={16} /> Xem trước</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        {/* KHUNG THÔNG TIN CHUNG */}
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
              <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-700 flex items-center gap-2 uppercase text-sm"><Info size={18} /> Thông tin chung</h3>
                  {origin === 'GAME_REPO' && <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">GAME REPO</span>}
              </div>
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg border border-slate-200 shadow-sm w-full sm:w-auto justify-between sm:justify-start">
                  <div className="flex items-center gap-2">
                      <Hash size={14} className="text-indigo-500"/>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mã đề:</span>
                      <span className="font-black text-indigo-700 text-lg">{examCode}</span>
                  </div>
                  <button onClick={() => setExamCode(generateExamCode())} className="p-1 hover:bg-white rounded transition" title="Tạo lại mã"><RefreshCcw size={14} className="text-blue-500"/></button>
              </div>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-xl md:text-3xl font-black border-b-2 border-slate-100 focus:border-indigo-500 outline-none py-2 mb-6 md:mb-8 placeholder-slate-200" placeholder="Tên bài kiểm tra..." />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><GraduationCap size={12}/> Khối lớp</label><select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl p-2.5 font-bold outline-none focus:border-indigo-500 bg-white">{GRADE_OPTIONS.map(g => <option key={g} value={g}>Khối {g}</option>)}</select></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><Book size={12}/> Môn học</label><select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl p-2.5 font-bold outline-none focus:border-indigo-500 bg-white"><option value="">-- Chọn môn --</option>{SUBJECT_OPTIONS.map((sub, i) => <option key={i} value={sub}>{sub}</option>)}</select></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><Users size={12}/> Lớp áp dụng</label><input value={assignedClass} onChange={(e) => setAssignedClass(e.target.value)} placeholder="VD: 10A1" className="w-full border-2 border-slate-100 rounded-xl p-2.5 font-bold focus:border-indigo-500 outline-none" /></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest flex items-center gap-1"><Clock size={12}/> Thời gian (Phút)</label><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl p-2.5 font-bold focus:border-indigo-500 outline-none text-center" /></div>
          </div>
        </div>

        {/* CẤU HÌNH ĐIỂM */}
        <div className="bg-gradient-to-r from-slate-50 to-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <h3 className="font-black text-slate-700 flex items-center gap-2 mb-4 uppercase text-sm"><Calculator size={18} /> Cấu trúc điểm ({scoreStats.totalScore} điểm)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-blue-50 p-3 md:p-4 rounded-xl border border-blue-100"><div className="flex justify-between items-center mb-2"><span className="text-blue-700 font-bold text-sm">P1: Trắc nghiệm</span><span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{scoreStats.p1Count} câu</span></div><div className="flex items-center gap-2"><input type="number" min="0" step="0.5" className="w-full border-2 border-blue-200 rounded-lg p-2 font-bold text-blue-900 text-center focus:border-blue-500 outline-none" value={scoreConfig.p1} onChange={(e) => setScoreConfig({...scoreConfig, p1: e.target.value})} /><span className="text-xs font-bold text-blue-400 whitespace-nowrap">Tổng điểm</span></div><div className="mt-2 text-xs text-blue-500 text-center font-medium">~ {scoreStats.p1PerQ} đ/câu</div></div>
                <div className="bg-red-50 p-3 md:p-4 rounded-xl border border-red-100 opacity-80"><div className="flex justify-between items-center mb-2"><span className="text-red-700 font-bold text-sm">P2: Đúng/Sai</span><span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full font-bold">{scoreStats.p2Count} câu lớn</span></div><div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-red-100 justify-center"><span className="text-red-500 font-bold text-xs md:text-sm text-center">Theo quy tắc GDPT</span><Info size={14} className="text-red-300 hidden md:block"/></div></div>
                <div className="bg-green-50 p-3 md:p-4 rounded-xl border border-green-100"><div className="flex justify-between items-center mb-2"><span className="text-green-700 font-bold text-sm">P3: Trả lời ngắn</span><span className="bg-green-200 text-green-800 text-xs px-2 py-1 rounded-full font-bold">{scoreStats.p3Count} câu</span></div><div className="flex items-center gap-2"><input type="number" min="0" step="0.5" className="w-full border-2 border-green-200 rounded-lg p-2 font-bold text-green-900 text-center focus:border-green-500 outline-none" value={scoreConfig.p3} onChange={(e) => setScoreConfig({...scoreConfig, p3: e.target.value})} /><span className="text-xs font-bold text-green-400 whitespace-nowrap">Tổng điểm</span></div><div className="mt-2 text-xs text-green-500 text-center font-medium">~ {scoreStats.p3PerQ} đ/câu</div></div>
            </div>
        </div>

        {/* DANH SÁCH CÂU HỎI */}
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 group transition-shadow hover:shadow-md">
            <div className="flex justify-between items-center">
              <span className={`px-2 py-1 md:px-3 md:py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-white ${q.type==='MCQ'?'bg-blue-500':q.type==='TF'?'bg-red-500':'bg-green-500'}`}>Câu {qIndex + 1} - {q.type}</span>
              <button onClick={() => removeQuestion(qIndex)} className="text-gray-300 hover:text-red-500 transition-colors p-2"><Trash2 size={18} /></button>
            </div>

            {/* Ô NHẬP CÂU HỎI */}
            <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                    <textarea 
                        value={q.q} 
                        onChange={(e) => updateQuestion(qIndex, 'q', e.target.value)} 
                        onPaste={(e) => handlePaste(e, qIndex, 'QUESTION')}
                        rows={3} 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 md:p-4 font-bold text-base md:text-lg focus:border-indigo-500 outline-none bg-slate-50 transition-all break-words" 
                        placeholder="Gõ nội dung hoặc dùng [img] chèn ảnh..." 
                    />
                    <button onClick={() => triggerUpload(qIndex, -1, 'QUESTION')} className="p-3 bg-slate-100 hover:bg-indigo-100 rounded-xl transition text-slate-500 hover:text-indigo-600 flex justify-center items-center sm:w-auto w-full border border-slate-200"><ImageIcon size={20}/><span className="sm:hidden ml-2 text-sm font-bold">Thêm ảnh</span></button>
                </div>
                {/* PREVIEW TOÁN VÀ ẢNH INLINE - Thêm overflow-x-auto */}
                {q.q && (
                    <details className="mt-2 group" open={q.q.includes('$') || q.q.includes('[img]')}>
                        <summary className="list-none text-xs font-bold text-indigo-500 cursor-pointer flex items-center gap-1 select-none py-1"><Eye size={14}/> Xem trước nội dung</summary>
                        <div className="mt-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-base md:text-lg font-bold overflow-x-auto break-words hide-scrollbar pb-2">
                            {renderWithInlineImage(q.q, q.img)}
                        </div>
                    </details>
                )}
                {q.img && !q.q.includes('[img]') && <div className="relative inline-block mt-2"><img src={q.img} className="max-h-48 rounded-lg shadow-lg border border-slate-200"/><button onClick={()=>updateQuestion(qIndex, 'img', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"><X size={12}/></button></div>}
            </div>

            {/* MCQ Answers */}
            {q.type === 'MCQ' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {q.a.map((ans, aIdx) => (
                        <div key={aIdx} className={`p-3 md:p-4 border-2 rounded-2xl transition-all shadow-sm ${q.correct === aIdx ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-white hover:border-blue-300'}`}>
                            <div className="flex gap-2 items-center mb-2">
                                <div onClick={()=>updateQuestion(qIndex, 'correct', aIdx)} className={`w-8 h-8 shrink-0 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${q.correct===aIdx?'bg-green-500 border-green-500 text-white':'bg-white border-slate-200 text-slate-300'}`}>{String.fromCharCode(65+aIdx)}</div>
                                <input 
                                    value={ans} 
                                    onChange={(e)=>updateMCQAnswer(qIndex, aIdx, e.target.value)} 
                                    onPaste={(e) => handlePaste(e, qIndex, 'ANSWER', aIdx)}
                                    className="w-full min-w-0 bg-transparent outline-none font-bold text-base md:text-lg" 
                                    placeholder="Đáp án..." 
                                />
                                <button onClick={() => triggerUpload(qIndex, aIdx, 'ANSWER')} className="text-slate-300 hover:text-blue-500 transition-colors shrink-0 p-1"><ImageIcon size={18}/></button>
                            </div>
                            {/* Thêm overflow-x-auto */}
                            {ans && (
                                <details className="mt-1"><summary className="list-none text-[10px] text-blue-400 cursor-pointer select-none py-1">Xem trước</summary>
                                    <div className="text-sm font-medium overflow-x-auto break-words hide-scrollbar pb-1">{renderWithInlineImage(ans, q.aImages?.[aIdx])}</div>
                                </details>
                            )}
                            {q.aImages?.[aIdx] && !ans.includes('[img]') && <div className="relative mt-2 inline-block"><img src={q.aImages[aIdx]} className="h-20 rounded border object-contain"/><button onClick={()=>{const n=[...q.aImages]; n[aIdx]=''; updateQuestion(qIndex, 'aImages', n)}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow"><X size={10}/></button></div>}
                        </div>
                    ))}
                </div>
            )}

            {/* Đúng/Sai Answers - TỐI ƯU LẠI GRID CHO MOBILE */}
            {q.type === 'TF' && (
                <div className="space-y-1 border rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100 p-2 text-[10px] font-black text-slate-500 flex justify-between uppercase tracking-wider hidden sm:flex">
                        <div className="pl-4 flex-1">Nội dung ý con</div>
                        <div className="w-16 md:w-20 text-center">Đúng</div>
                        <div className="w-16 md:w-20 text-center">Sai</div>
                    </div>
                    {q.items.map((item, iIdx) => (
                        <div key={iIdx} className="p-3 border-t bg-white flex flex-col sm:flex-row gap-3 sm:gap-2 items-start sm:items-center hover:bg-slate-50">
                            <div className="flex-1 w-full space-y-2 pl-0 sm:pl-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-400 text-sm">{String.fromCharCode(97+iIdx)})</span>
                                    <input 
                                        value={item.text} 
                                        onChange={(e)=>updateTFItem(qIndex, iIdx, 'text', e.target.value)}
                                        onPaste={(e) => handlePaste(e, qIndex, 'TF_ITEM', iIdx)} 
                                        className="w-full bg-transparent outline-none font-bold text-base md:text-lg" 
                                        placeholder="Nhập nội dung..." 
                                    />
                                     <button onClick={() => triggerUpload(qIndex, iIdx, 'TF_ITEM')} className="text-slate-300 hover:text-blue-500 transition-colors shrink-0 p-1"><ImageIcon size={18}/></button>
                                </div>
                                {item.img && !item.text.includes('[img]') && (
                                    <div className="relative inline-block ml-6">
                                        <img src={item.img} className="h-16 rounded border object-contain" />
                                        <button onClick={() => updateTFItem(qIndex, iIdx, 'img', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow"><X size={10}/></button>
                                    </div>
                                )}
                                {/* Thêm overflow-x-auto */}
                                {item.text && (
                                    <details className="ml-6"><summary className="list-none text-[10px] text-blue-400 cursor-pointer py-1">Xem trước</summary>
                                        <div className="text-sm overflow-x-auto break-words hide-scrollbar pb-1">{renderWithInlineImage(item.text, item.img)}</div>
                                    </details>
                                )}
                            </div>
                            
                            {/* Nút Đ/S trên mobile đặt ngang ra cho đẹp */}
                            <div className="flex w-full sm:w-auto gap-2 justify-end sm:justify-center mt-2 sm:mt-0">
                                <button onClick={() => updateTFItem(qIndex, iIdx, 'isTrue', true)} className={`w-10 h-10 sm:w-12 sm:h-12 md:w-10 md:h-10 rounded-xl border-2 font-black transition-all ${item.isTrue === true ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-200' : 'bg-white border-slate-200 text-slate-300 hover:border-green-300'}`}>Đ</button>
                                <button onClick={() => updateTFItem(qIndex, iIdx, 'isTrue', false)} className={`w-10 h-10 sm:w-12 sm:h-12 md:w-10 md:h-10 rounded-xl border-2 font-black transition-all ${item.isTrue === false ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200' : 'bg-white border-slate-200 text-slate-300 hover:border-red-300'}`}>S</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trả lời ngắn */}
            {q.type === 'SA' && (
                <div className="bg-green-50 p-4 md:p-6 rounded-2xl border border-green-100 shadow-inner">
                    <label className="block text-[10px] font-black text-green-700 uppercase mb-2 md:mb-3 tracking-widest">Đáp án chính xác (Học sinh phải gõ khớp):</label>
                    <input 
                        value={q.correct} 
                        onChange={(e) => updateQuestion(qIndex, 'correct', e.target.value)} 
                        className="w-full border-2 border-green-200 p-3 md:p-4 rounded-xl focus:border-green-500 outline-none font-black text-lg md:text-xl text-green-900 bg-white shadow-sm" 
                        placeholder="..." 
                    />
                    {/* Thêm overflow-x-auto */}
                    {q.correct && q.correct.includes('$') && (
                        <details className="mt-2"><summary className="list-none text-xs text-green-600 cursor-pointer py-1">Xem trước công thức</summary><div className="mt-1 p-3 bg-white/50 rounded-lg overflow-x-auto break-words hide-scrollbar pb-1"><MathRender content={q.correct} className="text-lg font-bold" /></div></details>
                    )}
                </div>
            )}
          </div>
        ))}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sticky bottom-6">
            <button onClick={() => addQuestion('MCQ')} className="py-3 md:py-4 bg-white border-2 border-dashed border-blue-300 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 shadow-lg"><List size={18}/> Thêm Trắc Nghiệm (P1)</button>
            <button onClick={() => addQuestion('TF')} className="py-3 md:py-4 bg-white border-2 border-dashed border-red-300 text-red-600 rounded-xl font-bold hover:bg-red-50 transition flex items-center justify-center gap-2 shadow-lg"><CheckSquare size={18}/> Thêm Đúng/Sai (P2)</button>
            <button onClick={() => addQuestion('SA')} className="py-3 md:py-4 bg-white border-2 border-dashed border-green-300 text-green-600 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 shadow-lg"><Type size={18}/> Thêm Trả Lời Ngắn (P3)</button>
        </div>
      </main>

      {/* MODAL PREVIEW */}
    {showFullPreview && (
      <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-4">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] flex flex-col shadow-2xl">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
            <h2 className="font-black text-slate-700 uppercase">Xem trước đề thi</h2>
            <button onClick={() => setShowFullPreview(false)} className="p-1 hover:bg-slate-200 rounded-full transition"><X size={24} className="text-slate-400" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 text-slate-800" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
            <div className="text-center mb-8">
              <h1 className="text-lg md:text-xl font-bold uppercase mb-1">{title || "TÊN BÀI KIỂM TRA"}</h1>
              <p className="font-medium text-sm md:text-base">Môn: {subject || "..."} | Khối: {grade} | Thời gian: {duration} phút</p>
              <div className="w-20 h-0.5 bg-black mx-auto mt-2"></div>
            </div>

            <div className="space-y-10">
              {questions.length > 0 ? (
                questions.map((q, idx) => (
                  <div key={q.id || idx} className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 items-start">
                      <span className="font-bold whitespace-nowrap">Câu {idx + 1}:</span>
                      {/* Thêm overflow-x-auto */}
                      <div className="inline-block leading-relaxed overflow-x-auto break-words hide-scrollbar pb-1 w-full">
                          {renderWithInlineImage(q.q, q.img)}
                      </div>
                    </div>
                    {q.img && !q.q.includes('[img]') && (
                        <div className="my-2"><img src={q.img} alt="Question" className="max-h-64 rounded-lg border shadow-sm mx-auto" /></div>
                    )}

                    {q.type === 'MCQ' && q.a && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 pl-2 sm:pl-6">
                        {q.a.map((ans, aIdx) => (
                          <div key={aIdx} className="flex gap-2 items-start">
                            <span className="font-bold">{String.fromCharCode(65 + aIdx)}.</span>
                            {/* Thêm overflow-x-auto */}
                            <div className="flex flex-col overflow-x-auto break-words hide-scrollbar pb-1 w-full">
                                {renderWithInlineImage(ans, q.aImages?.[aIdx])}
                                {q.aImages && q.aImages[aIdx] && !ans.includes('[img') && (
                                    <img src={q.aImages[aIdx]} className="max-h-32 mt-1 rounded border object-contain"/>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'TF' && q.items && (
                      <div className="pl-2 sm:pl-6 space-y-2">
                        {q.items.map((item, iIdx) => (
                          <div key={iIdx} className="flex gap-2 sm:gap-3 items-start italic border-b border-dashed pb-2 last:border-0">
                            <span className="min-w-[20px] sm:min-w-[25px]">{String.fromCharCode(97 + iIdx)})</span>
                            {/* Thêm overflow-x-auto */}
                            <div className="flex-1 overflow-x-auto break-words hide-scrollbar pb-1">
                                 {renderWithInlineImage(item.text, item.img)}
                                 {item.img && !item.text.includes('[img]') && <img src={item.img} className="max-h-32 mt-1 rounded border object-contain block"/>}
                            </div>
                            <span className="text-[10px] sm:text-xs text-slate-400 font-bold ml-auto whitespace-nowrap">[{item.isTrue ? "Đúng" : "Sai"}]</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'SA' && <div className="pl-2 sm:pl-6 italic text-slate-500 text-sm">(Học sinh trả lời ngắn vào ô trống)</div>}
                  </div>
                ))
              ) : (<div className="text-center py-10 text-slate-400">Chưa có câu hỏi nào để hiển thị.</div>)}
            </div>
          </div>
          <div className="p-3 md:p-4 border-t bg-slate-50 flex justify-end rounded-b-2xl">
             <button onClick={() => setShowFullPreview(false)} className="px-6 py-2 md:px-8 md:py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg w-full md:w-auto">ĐÓNG XEM TRƯỚC</button>
          </div>
        </div>
      </div>
    )}
      {/* CSS ẩn thanh cuộn nhưng vẫn vuốt được */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}