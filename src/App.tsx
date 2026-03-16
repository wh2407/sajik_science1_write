/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, BookOpen, Zap, Lightbulb, Pin, Printer, Send, Users, ArrowLeft, LogIn, LogOut, MessageSquare, ShieldCheck, Award, UserCircle, Edit2, Trash2, HelpCircle, X } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';

const DrawingCanvas = ({ 
  label, 
  caption, 
  onCaptionChange, 
  id, 
  readOnly = false, 
  initialImage = '' 
}: { 
  key?: number | string,
  label: string, 
  caption: string, 
  onCaptionChange?: (val: string) => void, 
  id: string,
  readOnly?: boolean,
  initialImage?: string
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;

        if (initialImage) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
          };
          img.src = initialImage;
        }
      }
    }
  }, [initialImage]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly || !isDrawing) return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    if (!coords) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="border-2 border-slate-500 rounded-lg overflow-hidden bg-white flex flex-col aspect-square relative group">
        <div className="bg-slate-700 text-white text-xs font-bold px-3 py-1 self-start m-2 rounded-sm z-10 shadow-sm">
          {label}
        </div>
        <canvas
          id={id}
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full touch-none bg-white ${readOnly ? 'cursor-default' : 'cursor-crosshair'}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!readOnly && (
          <button 
            onClick={clearCanvas} 
            className="absolute bottom-2 right-2 text-xs font-medium text-slate-500 hover:text-red-500 z-10 print:hidden bg-white/90 px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            지우기
          </button>
        )}
      </div>
      {readOnly ? (
        <div className="mt-3 w-full text-sm text-center text-slate-700 font-medium pb-1 min-h-[28px]">
          {caption}
        </div>
      ) : (
        <input
          type="text"
          value={caption}
          onChange={(e) => onCaptionChange?.(e.target.value)}
          className="mt-3 w-full border-b border-dashed border-slate-400 outline-none text-sm text-center bg-transparent focus:border-indigo-500 transition-colors pb-1"
          placeholder="설명을 적어주세요"
        />
      )}
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'write' | 'board' | 'detail' | 'teacher'>('write');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localUid, setLocalUid] = useState<string>('');
  
  // Student Info State
  const [myInfo, setMyInfo] = useState({ classNumber: '', studentNumber: '', studentName: '' });
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [exampleTab, setExampleTab] = useState<1 | 2>(1);

  // Teacher Mode State
  const [isTeacher, setIsTeacher] = useState(false);
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [deletingSubmission, setDeletingSubmission] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ classNumber: '', studentNumber: '', studentName: '' });

  // Form State
  const [formData, setFormData] = useState({
    classNumber: '',
    studentNumber: '',
    studentName: '',
    characterName: '',
    characterTraits: '',
    event: '',
    eventOther: '',
    title: '',
    conflict: '',
    solution: '',
    sciencePrinciple: ''
  });
  const [captions, setCaptions] = useState(['', '', '', '']);

  // Board State
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | 'all'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  // Feedback State
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [newFeedback, setNewFeedback] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  
  // All Feedbacks (for teacher mode)
  const [allFeedbacks, setAllFeedbacks] = useState<any[]>([]);

  useEffect(() => {
    let uid = localStorage.getItem('studentUid');
    if (!uid) {
      uid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('studentUid', uid);
    }
    setLocalUid(uid);

    const saved = localStorage.getItem('studentInfo');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMyInfo(parsed);
        setFormData(prev => ({ 
          ...prev, 
          classNumber: parsed.classNumber || '', 
          studentNumber: parsed.studentNumber || '', 
          studentName: parsed.studentName || '' 
        }));
      } catch(e) {}
    }
  }, []);

  const fetchSubmissions = async () => {
    try {
      let q = query(collection(db, 'worksheets'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubmissions(data);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    }
  };

  const fetchAllFeedbacks = async () => {
    try {
      let q = query(collection(db, 'feedbacks'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllFeedbacks(data);
    } catch (error) {
      console.error("Error fetching all feedbacks:", error);
    }
  };

  const fetchFeedbacksForSubmission = async (worksheetId: string) => {
    try {
      let q = query(collection(db, 'feedbacks'), where('worksheetId', '==', worksheetId), orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFeedbacks(data);
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
    }
  };

  useEffect(() => {
    if (view === 'board') {
      fetchSubmissions();
      fetchAllFeedbacks();
    } else if (view === 'teacher') {
      fetchSubmissions();
      fetchAllFeedbacks();
    }
  }, [view]);

  useEffect(() => {
    if (view === 'detail' && selectedSubmission) {
      fetchFeedbacksForSubmission(selectedSubmission.id);
    }
  }, [view, selectedSubmission]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (['classNumber', 'studentNumber', 'studentName'].includes(name)) {
      const newInfo = { ...myInfo, [name]: value };
      setMyInfo(newInfo);
      localStorage.setItem('studentInfo', JSON.stringify(newInfo));
    }
  };

  const handleSubmit = async () => {
    if (!formData.classNumber || !formData.studentNumber || !formData.studentName) {
      alert("학년, 반, 번호, 이름을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const drawings = [0, 1, 2, 3].map(i => {
        const canvas = document.getElementById(`canvas-${i}`) as HTMLCanvasElement;
        if (!canvas) return '';
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          ctx.drawImage(canvas, 0, 0);
          return tempCanvas.toDataURL('image/jpeg', 0.6);
        }
        return canvas.toDataURL('image/png');
      });

      await addDoc(collection(db, 'worksheets'), {
        grade: 1,
        classNumber: parseInt(formData.classNumber) || 0,
        studentNumber: parseInt(formData.studentNumber) || 0,
        studentName: formData.studentName,
        characterName: formData.characterName,
        characterTraits: formData.characterTraits,
        event: formData.event,
        eventOther: formData.eventOther,
        title: formData.title,
        conflict: formData.conflict,
        solution: formData.solution,
        sciencePrinciple: formData.sciencePrinciple,
        drawings,
        captions,
        createdAt: serverTimestamp(),
        authorUid: localUid
      });

      alert("성공적으로 제출되었습니다!");
      setView('board');
    } catch (error) {
      console.error("Error submitting document: ", error);
      alert("제출 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!myInfo.classNumber || !myInfo.studentName) {
      alert("우측 상단에서 학생 정보를 먼저 입력해주세요.");
      setShowInfoModal(true);
      return;
    }

    if (!newFeedback.trim()) return;

    setIsSubmittingFeedback(true);
    try {
      await addDoc(collection(db, 'feedbacks'), {
        worksheetId: selectedSubmission.id,
        authorUid: localUid,
        authorName: `${myInfo.classNumber}반 ${myInfo.studentNumber}번 ${myInfo.studentName}`,
        content: newFeedback.trim(),
        createdAt: serverTimestamp()
      });
      
      setNewFeedback('');
      fetchFeedbacksForSubmission(selectedSubmission.id);
    } catch (error) {
      console.error("Error submitting feedback: ", error);
      alert("피드백 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleTeacherLogin = () => {
    if (teacherPassword === '0607') {
      setIsTeacher(true);
      setShowTeacherLogin(false);
      setTeacherPassword('');
      setView('teacher');
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const handleDeleteSubmission = async () => {
    if (!deletingSubmission) return;
    try {
      await deleteDoc(doc(db, 'worksheets', deletingSubmission.id));
      setDeletingSubmission(null);
      fetchSubmissions();
      if (view === 'detail' && selectedSubmission?.id === deletingSubmission.id) {
        setView('board');
      }
    } catch (error) {
      console.error("Error deleting submission: ", error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const renderWorksheet = (data: any, isReadOnly: boolean) => (
    <div className="w-full bg-white p-8 md:p-12 shadow-xl rounded-2xl print:shadow-none print:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-[3px] border-slate-800 pb-6 mb-10 gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            나도 이제 입자! <Search className="w-8 h-8 md:w-10 md:h-10 text-indigo-600" strokeWidth={3} />
          </h1>
          <p className="text-base md:text-lg font-bold text-slate-500 mt-2 tracking-wide">영재쌤과 함께하는 온도별 우당탕탕 하루 스토리</p>
        </div>
        <div className="flex flex-col gap-4 text-base md:text-lg font-bold w-full md:w-auto">
          <div className="flex items-center justify-end gap-2">
            <span className="w-16 text-center border-b-2 border-dashed border-slate-400">1</span> 학년
            {isReadOnly ? (
              <span className="w-16 text-center border-b-2 border-dashed border-slate-400">{data.classNumber}</span>
            ) : (
              <input type="number" name="classNumber" value={formData.classNumber} onChange={handleInputChange} className="w-16 border-b-2 border-dashed border-slate-400 text-center outline-none bg-transparent focus:border-indigo-500" />
            )} 반
            {isReadOnly ? (
              <span className="w-16 text-center border-b-2 border-dashed border-slate-400">{data.studentNumber}</span>
            ) : (
              <input type="number" name="studentNumber" value={formData.studentNumber} onChange={handleInputChange} className="w-16 border-b-2 border-dashed border-slate-400 text-center outline-none bg-transparent focus:border-indigo-500" />
            )} 번
          </div>
          <div className="flex items-center justify-end gap-2">
            이름: 
            {isReadOnly ? (
              <span className="w-48 text-center border-b-2 border-dashed border-slate-400">{data.studentName}</span>
            ) : (
              <input type="text" name="studentName" value={formData.studentName} onChange={handleInputChange} className="w-48 border-b-2 border-dashed border-slate-400 text-center outline-none bg-transparent focus:border-indigo-500" />
            )}
          </div>
        </div>
      </div>

      {/* Section 1 & 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Section 1 */}
        <div className="border-[2px] border-slate-400 rounded-2xl p-6 relative bg-white">
          <div className="absolute -top-4 left-6 bg-slate-700 text-white px-5 py-1.5 rounded-full font-bold text-sm shadow-sm tracking-wide">
            1. 나의 입자 캐릭터
          </div>
          <div className="mt-4 flex flex-col gap-6">
            <div className="flex items-center gap-3 font-bold text-slate-700">
              이름: 
              {isReadOnly ? (
                <span className="flex-1 border-b-2 border-dashed border-slate-300 pb-1">{data.characterName}</span>
              ) : (
                <input type="text" name="characterName" value={formData.characterName} onChange={handleInputChange} className="flex-1 border-b-2 border-dashed border-slate-300 outline-none focus:border-indigo-500 bg-transparent" />
              )}
            </div>
            <div className="flex flex-col gap-2 font-bold text-slate-700">
              <div className="flex items-baseline gap-2">
                성격 및 특징: <span className="text-xs font-normal text-slate-400">(예: 추위를 많이 탄다, 에너지가 넘친다)</span>
              </div>
              {isReadOnly ? (
                <div className="w-full h-28 border-2 border-slate-200 rounded-xl p-3 bg-slate-50 whitespace-pre-wrap font-normal">{data.characterTraits}</div>
              ) : (
                <textarea name="characterTraits" value={formData.characterTraits} onChange={handleInputChange} className="w-full h-28 border-2 border-slate-200 rounded-xl p-3 outline-none resize-none bg-slate-50 focus:bg-white focus:border-indigo-300 transition-colors"></textarea>
              )}
            </div>
          </div>
        </div>

        {/* Section 2 */}
        <div className="border-[2px] border-slate-400 rounded-2xl p-6 relative bg-white">
          <div className="absolute -top-4 left-6 bg-slate-700 text-white px-5 py-1.5 rounded-full font-bold text-sm shadow-sm tracking-wide">
            2. 이야기의 시작 사건
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm font-bold text-slate-600 mb-1">주인공이 겪게 될 온도 변화 상황을 하나 고르세요.</p>
            {['차가운 냉장고 속에 있던 캔이 따뜻한 방으로 나왔다!', '따뜻한 방에 있던 풍선이 눈 내리는 밖으로 나갔다!', '그늘에 있던 나에게 갑자기 뜨거운 햇볕이 비친다!'].map((evt, idx) => (
              <label key={idx} className="flex items-start gap-3 cursor-pointer group">
                <input 
                  type="radio" 
                  name="event" 
                  value={evt}
                  checked={isReadOnly ? data.event === evt : formData.event === evt}
                  onChange={handleInputChange}
                  disabled={isReadOnly}
                  className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300" 
                />
                <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors">{evt}</span>
              </label>
            ))}
            <label className="flex items-center gap-3 cursor-pointer group mt-1">
              <input 
                type="radio" 
                name="event" 
                value="기타"
                checked={isReadOnly ? data.event === '기타' : formData.event === '기타'}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300" 
              />
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">기타:</span>
              {isReadOnly ? (
                <span className="flex-1 border-b-2 border-dashed border-slate-300 text-sm pb-1">{data.eventOther}</span>
              ) : (
                <input type="text" name="eventOther" value={formData.eventOther} onChange={handleInputChange} className="flex-1 border-b-2 border-dashed border-slate-300 outline-none text-sm bg-transparent focus:border-indigo-500" />
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Section 3 */}
      <div className="border-[2px] border-slate-400 rounded-2xl p-6 relative mb-10 bg-white">
        <div className="absolute -top-4 left-6 bg-slate-700 text-white px-5 py-1.5 rounded-full font-bold text-sm shadow-sm tracking-wide">
          3. 이야기 전개 (소설 개요)
        </div>
        <div className="mt-6 flex flex-col gap-8">
          <div className="flex items-center gap-3 font-bold text-lg text-slate-800">
            <BookOpen className="w-6 h-6 text-indigo-500" /> 제목:
            {isReadOnly ? (
              <span className="flex-1 border-b-2 border-slate-300 pb-1">{data.title}</span>
            ) : (
              <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="flex-1 border-b-2 border-slate-300 outline-none focus:border-indigo-500 bg-transparent pb-1" />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t-2 border-b-2 border-slate-100 py-6">
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-orange-600 flex items-center gap-2 text-base">
                <Zap className="w-5 h-5" fill="currentColor" /> 갈등 상황 (문제 발생!)
              </h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">온도가 변하면서 나의 '움직임'은 어떻게 달라졌나요? 친구들과 부딪혔나요?</p>
              {isReadOnly ? (
                <div className="w-full h-36 border-2 border-slate-200 rounded-xl p-3 bg-slate-50 whitespace-pre-wrap font-normal text-sm">{data.conflict}</div>
              ) : (
                <textarea name="conflict" value={formData.conflict} onChange={handleInputChange} className="w-full h-36 border-2 border-slate-200 rounded-xl p-3 outline-none resize-none bg-slate-50 focus:bg-white focus:border-orange-300 transition-colors"></textarea>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-amber-500 flex items-center gap-2 text-base">
                <Lightbulb className="w-5 h-5" fill="currentColor" /> 해결 및 과학 원리
              </h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">이 문제를 어떻게 받아들였나요? 온도와 입자 운동의 관계를 넣어 적어주세요.</p>
              {isReadOnly ? (
                <div className="w-full h-36 border-2 border-slate-200 rounded-xl p-3 bg-slate-50 whitespace-pre-wrap font-normal text-sm">{data.solution}</div>
              ) : (
                <textarea name="solution" value={formData.solution} onChange={handleInputChange} className="w-full h-36 border-2 border-slate-200 rounded-xl p-3 outline-none resize-none bg-slate-50 focus:bg-white focus:border-amber-300 transition-colors"></textarea>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 font-bold text-slate-800">
            <Pin className="w-6 h-6 text-rose-500" fill="currentColor" /> 사용한 과학 원리 한 줄 요약:
            {isReadOnly ? (
              <span className="flex-1 border-b-2 border-slate-300 pb-1">{data.sciencePrinciple}</span>
            ) : (
              <input type="text" name="sciencePrinciple" value={formData.sciencePrinciple} onChange={handleInputChange} className="flex-1 border-b-2 border-slate-300 outline-none focus:border-rose-400 bg-transparent pb-1" />
            )}
          </div>
        </div>
      </div>

      {/* Section 4 */}
      <div className="border-[2px] border-slate-400 rounded-2xl p-6 relative bg-white">
        <div className="absolute -top-4 left-6 bg-slate-700 text-white px-5 py-1.5 rounded-full font-bold text-sm shadow-sm tracking-wide">
          4. 핵심 장면 네 컷 만화
        </div>
        <div className="mt-6">
          <p className="text-sm font-bold text-indigo-600 mb-6 flex items-center gap-2 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
            <span className="text-lg">※</span> 주의! 온도가 변해도 입자의 크기는 변하지 않아요. 빠르기는 화살표로 표현하세요!
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['1컷: 평온한 상태', '2컷: 온도 변화 발생', '3컷: 하이라이트!', '4컷: 결과 및 마무리'].map((label, idx) => (
              <DrawingCanvas 
                key={idx}
                id={`canvas-${idx}`}
                label={label} 
                caption={isReadOnly ? data.captions?.[idx] : captions[idx]} 
                onCaptionChange={isReadOnly ? undefined : (val) => setCaptions(prev => { const n = [...prev]; n[idx] = val; return n; })} 
                readOnly={isReadOnly}
                initialImage={isReadOnly ? data.drawings?.[idx] : ''}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isReadOnly && (
        <div className="mt-12 flex flex-wrap justify-center gap-4 print:hidden">
          <button 
            onClick={handlePrint} 
            className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 px-8 rounded-full shadow transition-all"
          >
            <Printer className="w-5 h-5" /> 인쇄 / PDF 저장
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50"
          >
            <Send className="w-5 h-5" /> {isSubmitting ? '제출 중...' : '게시판에 제출하기'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans print:bg-white text-slate-800">
      {/* Top Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 print:hidden">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Search className="w-6 h-6 text-indigo-600" strokeWidth={3} /> 나도 이제 입자!
          </h1>
          <div className="h-6 w-px bg-slate-300 mx-2"></div>
          <button 
            onClick={() => setView('write')}
            className={`font-bold px-4 py-2 rounded-full transition-colors ${view === 'write' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            작성하기
          </button>
          <button 
            onClick={() => setShowExampleModal(true)}
            className={`font-bold px-4 py-2 rounded-full transition-colors flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50 border border-emerald-200`}
          >
            <HelpCircle className="w-4 h-4" /> 예시 보기
          </button>
          <button 
            onClick={() => setView('board')}
            className={`font-bold px-4 py-2 rounded-full transition-colors flex items-center gap-2 ${view === 'board' || view === 'detail' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Users className="w-4 h-4" /> 학급 게시판
          </button>
          {isTeacher && (
            <button 
              onClick={() => setView('teacher')}
              className={`font-bold px-4 py-2 rounded-full transition-colors flex items-center gap-2 ${view === 'teacher' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <ShieldCheck className="w-4 h-4" /> 교사 모드
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!isTeacher && (
            <button 
              onClick={() => setShowTeacherLogin(true)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              교사 로그인
            </button>
          )}
          <button 
            onClick={() => setShowInfoModal(true)} 
            className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-full"
          >
            <UserCircle className="w-5 h-5" /> 
            {myInfo.studentName ? `${myInfo.classNumber}반 ${myInfo.studentNumber}번 ${myInfo.studentName}` : '학생 정보 입력'}
          </button>
          {isTeacher && (
            <button onClick={() => { setIsTeacher(false); setView('board'); }} className="text-sm text-rose-500 hover:text-rose-700 flex items-center gap-1 font-bold">
              <LogOut className="w-4 h-4" /> 교사 모드 종료
            </button>
          )}
        </div>
      </div>

      {/* Student Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserCircle className="w-6 h-6 text-indigo-600" /> 내 정보 입력
            </h3>
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex items-center gap-2">
                <input type="number" placeholder="반" value={myInfo.classNumber} onChange={e => setMyInfo({...myInfo, classNumber: e.target.value})} className="w-1/2 border-2 border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
                <input type="number" placeholder="번호" value={myInfo.studentNumber} onChange={e => setMyInfo({...myInfo, studentNumber: e.target.value})} className="w-1/2 border-2 border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
              </div>
              <input type="text" placeholder="이름" value={myInfo.studentName} onChange={e => setMyInfo({...myInfo, studentName: e.target.value})} className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInfoModal(false)} className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100">닫기</button>
              <button onClick={() => {
                localStorage.setItem('studentInfo', JSON.stringify(myInfo));
                setFormData(prev => ({ ...prev, classNumber: myInfo.classNumber, studentNumber: myInfo.studentNumber, studentName: myInfo.studentName }));
                setShowInfoModal(false);
              }} className="px-4 py-2 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Edit Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Edit2 className="w-6 h-6 text-indigo-600" /> 학생 정보 수정
            </h3>
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex items-center gap-2">
                <input type="number" placeholder="반" value={editFormData.classNumber} onChange={e => setEditFormData({...editFormData, classNumber: e.target.value})} className="w-1/2 border-2 border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
                <input type="number" placeholder="번호" value={editFormData.studentNumber} onChange={e => setEditFormData({...editFormData, studentNumber: e.target.value})} className="w-1/2 border-2 border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
              </div>
              <input type="text" placeholder="이름" value={editFormData.studentName} onChange={e => setEditFormData({...editFormData, studentName: e.target.value})} className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingStudent(null)} className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100">취소</button>
              <button onClick={async () => {
                try {
                  await updateDoc(doc(db, 'worksheets', editingStudent.id), {
                    classNumber: parseInt(editFormData.classNumber) || 0,
                    studentNumber: parseInt(editFormData.studentNumber) || 0,
                    studentName: editFormData.studentName
                  });
                  setEditingStudent(null);
                  fetchSubmissions();
                } catch (e) {
                  console.error(e);
                  alert('수정 실패');
                }
              }} className="px-4 py-2 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Delete Modal */}
      {deletingSubmission && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-rose-600" /> 게시물 삭제
            </h3>
            <p className="text-slate-600 mb-6 font-medium">
              {deletingSubmission.classNumber}반 {deletingSubmission.studentNumber}번 {deletingSubmission.studentName} 학생의 작품을 정말 삭제하시겠습니까?<br/>
              <span className="text-sm text-rose-500 mt-2 block">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingSubmission(null)} className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100">취소</button>
              <button onClick={handleDeleteSubmission} className="px-4 py-2 rounded-lg font-bold bg-rose-600 text-white hover:bg-rose-700">삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* Example Modal */}
      {showExampleModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className="bg-[#f5f7f5] rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#2d5a3c] text-white p-6 flex justify-between items-start shrink-0 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
              <div className="relative z-10">
                <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-3 border border-white/30">
                  예시 답안 — 학생 참고용
                </span>
                <h2 className="text-3xl font-black mb-2 tracking-tight">나도 이제 입자!<br/>영재쌤과 함께하는 온도별 우당탕탕 하루 스토리</h2>
                <p className="text-emerald-100 font-medium">아래 예시를 참고하여 자신만의 입자 이야기를 만들어 보세요.</p>
                <div className="flex gap-2 mt-4 text-xs font-bold">
                  <span className="border border-white/40 px-3 py-1 rounded-full">중학교 1학년</span>
                  <span className="border border-white/40 px-3 py-1 rounded-full">과학 — 입자와 온도</span>
                  <span className="border border-white/40 px-3 py-1 rounded-full">사용 개념: 온도↑ → 입자 움직임↑</span>
                </div>
              </div>
              <button onClick={() => setShowExampleModal(false)} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors relative z-10">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-200 px-6 pt-2 bg-white shrink-0">
              <button 
                onClick={() => setExampleTab(1)} 
                className={`py-3 px-4 font-bold border-b-[3px] transition-colors ${exampleTab === 1 ? 'border-[#2d5a3c] text-[#2d5a3c]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                예시 1: 콜콜이의 하루
              </button>
              <button 
                onClick={() => setExampleTab(2)} 
                className={`py-3 px-4 font-bold border-b-[3px] transition-colors ${exampleTab === 2 ? 'border-[#2d5a3c] text-[#2d5a3c]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                예시 2: 멈출 수 없는 댄스 파티
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {exampleTab === 1 && (
                <>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-900 font-medium">
                    <span className="font-bold text-amber-700">이 예시에서 사용한 과학 개념:</span> 온도가 높을수록 입자가 빠르게 움직이고, 온도가 낮을수록 입자가 느리게 움직인다.<br/>
                    <span className="text-amber-700/70 text-xs mt-1 block">※ 열에너지, 열팽창, 운동 에너지 같은 표현은 아직 배우지 않았으므로 사용하지 않았습니다.</span>
                  </div>

                  {/* Section 1 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[#2d5a3c] flex items-center gap-2 mb-4">
                      <span className="bg-[#2d5a3c] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span> 나의 입자 캐릭터
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-slate-400 mb-2 block">이름</label>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg font-bold text-slate-800">콜콜이</div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 mb-2 block">성격 및 특징 (예: 추위를 많이 탄다, 에너지가 넘친다)</label>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-slate-700 text-sm leading-relaxed">
                          추울 때는 느릿느릿 조용한 편이다. 그런데 따뜻해지면 갑자기 활발해지면서 가만히 있지를 못한다. 주변 친구들과 자꾸 부딪히는 게 특기다.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[#2d5a3c] flex items-center gap-2 mb-4">
                      <span className="bg-[#2d5a3c] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span> 이야기의 시작 사건
                    </h3>
                    <p className="text-sm text-slate-500 mb-4 font-medium">주인공이 처음 겪은 온도 변화 상황을 하나 고르세요.</p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-slate-800 font-bold bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                        <div className="w-5 h-5 bg-[#2d5a3c] rounded flex items-center justify-center text-white text-xs">✓</div>
                        차가운 냉장고 속에 있던 캔이 따뜻한 방으로 나왔다!
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 font-medium p-3">
                        <div className="w-5 h-5 border-2 border-slate-300 rounded"></div>
                        따뜻한 방에 있던 풍선이 눈 내리는 밖으로 나갔다!
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 font-medium p-3">
                        <div className="w-5 h-5 border-2 border-slate-300 rounded"></div>
                        그늘에 있던 나에게 갑자기 뜨거운 햇빛이 비친다!
                      </div>
                    </div>
                  </div>

                  {/* Section 3 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[#2d5a3c] flex items-center gap-2 mb-4">
                      <span className="bg-[#2d5a3c] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span> 이야기 전개 (소설 요약)
                    </h3>
                    <div className="mb-6">
                      <label className="text-xs font-bold text-slate-400 mb-2 block">제목</label>
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg font-bold text-slate-800 text-lg">
                        콜콜이, 냉장고 밖 세상에서 눈을 뜨다
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="text-sm font-bold text-rose-600 mb-2 flex items-center gap-1"><Zap className="w-4 h-4" /> 갈등 상황 (문제 발생!)</label>
                        <div className="bg-rose-50 border border-rose-100 p-5 rounded-xl text-slate-700 text-sm leading-relaxed h-full">
                          나 콜콜이는 차가운 냉장고 안에서 오랫동안 살았다. 안은 항상 시원해서 나는 천천히, 조용히 움직이며 친구들과 가까이 붙어 지냈다.<br/><br/>
                          그런데 오늘 갑자기 누군가가 캔을 꺼내더니 따뜻한 방 안에 두고 가 버렸다. 그 순간부터 나는 몸을 멈출 수가 없었다! 자꾸 빨라지는 느낌이고, 친구들이랑 부딪히고, 뭔가 이상한 하루가 시작됐다.
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-amber-600 mb-2 flex items-center gap-1"><Lightbulb className="w-4 h-4" /> 해결 및 과학 원리</label>
                        <div className="bg-amber-50 border border-amber-100 p-5 rounded-xl text-slate-700 text-sm leading-relaxed h-full">
                          방 안의 온도가 냉장고보다 훨씬 높았기 때문이다. 온도가 높아지면 입자는 더 빠르게 움직인다. 그래서 나(콜콜이)도 점점 빠르게 움직이게 된 것이다.<br/><br/>
                          반대로 냉장고 안처럼 온도가 낮으면 입자는 천천히 움직인다. 결국 오늘 내가 갑자기 활발해진 건 내 성격이 바뀐 게 아니라, 온도가 올라갔기 때문이었다!
                        </div>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                      <label className="text-xs font-bold text-emerald-700 mb-1 block">사용한 과학 원리 한 줄 요약</label>
                      <div className="font-bold text-slate-800">온도가 높아지면 입자가 빠르게 움직이고, 온도가 낮아지면 입자가 느리게 움직인다.</div>
                    </div>
                  </div>

                  {/* Section 4 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[#2d5a3c] flex items-center gap-2 mb-4">
                      <span className="bg-[#2d5a3c] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span> 핵심 장면 네 컷 만화
                    </h3>
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 text-sm text-slate-600 font-medium">
                      <span className="font-bold text-indigo-600">주의:</span> 입자는 온도가 변해도 크기는 변하지 않아요. 빠르기는 화살표로 표현하세요!<br/>
                      아래 예시는 입자(동그라미)의 <span className="font-bold text-slate-800">위치와 간격</span>으로 움직임의 변화를 나타낸 것입니다.
                    </div>
                    
                    <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                      <img 
                        src="/kolkol_comic.png" 
                        alt="콜콜이의 하루 4컷 만화" 
                        className="w-full h-auto object-contain max-h-[800px] rounded-lg shadow-sm"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden">
                        <div className="w-16 h-16 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-slate-700 font-bold text-lg mb-2">첨부하신 4컷 만화 이미지가 들어갈 자리입니다.</p>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">
                          AI 환경의 제한으로 이미지 파일을 직접 저장할 수 없습니다.<br/>
                          <span className="text-indigo-600 font-bold">public</span> 폴더에 <code className="bg-slate-200 px-1 rounded">kolkol_comic.png</code> 이름으로 이미지를 업로드하시면 여기에 나타납니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {exampleTab === 2 && (
                <>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-900 font-medium">
                    <span className="font-bold text-amber-700">이 예시에서 사용한 과학 개념:</span> 온도가 높아지면 입자의 운동이 활발해지고, 온도가 낮아지면 입자의 운동이 둔해진다.
                  </div>

                  {/* Section 1 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[#2d5a3c] flex items-center gap-2 mb-4">
                      <span className="bg-[#2d5a3c] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span> 나의 입자 캐릭터
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-slate-400 mb-2 block">이름</label>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg font-bold text-slate-800">잠보 (주인공), 까불이 (친구)</div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 mb-2 block">성격 및 특징</label>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-slate-700 text-sm leading-relaxed">
                          <span className="font-bold text-indigo-600">잠보:</span> 천천히 움직이는 것을 좋아하는 물 입자<br/>
                          <span className="font-bold text-rose-600">까불이:</span> 조금만 따뜻해져도 빨리 뛰고 싶어 하는 입자
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[#2d5a3c] flex items-center gap-2 mb-4">
                      <span className="bg-[#2d5a3c] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span> 이야기의 시작 사건
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-slate-800 font-bold bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                        <div className="w-5 h-5 bg-[#2d5a3c] rounded flex items-center justify-center text-white text-xs">✓</div>
                        시원한 에어컨 바람 아래 있던 물컵이 햇볕이 쨍쨍한 창가로 옮겨졌다.
                      </div>
                    </div>
                  </div>

                  {/* Section 3 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[#2d5a3c] flex items-center gap-2 mb-4">
                      <span className="bg-[#2d5a3c] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span> 이야기 전개 (소설 요약)
                    </h3>
                    <div className="mb-6">
                      <label className="text-xs font-bold text-slate-400 mb-2 block">제목</label>
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg font-bold text-slate-800 text-lg">
                        멈출 수 없는 댄스 파티
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="text-sm font-bold text-rose-600 mb-2 flex items-center gap-1"><Zap className="w-4 h-4" /> 갈등 상황 (문제 발생!)</label>
                        <div className="bg-rose-50 border border-rose-100 p-5 rounded-xl text-slate-700 text-sm leading-relaxed h-full">
                          창가로 옮겨지자 온도가 올라가기 시작했다. '잠보'는 계속 천천히 있고 싶었지만, 온도가 높아지자 다리가 제멋대로 빠르게 움직이기 시작했다.<br/><br/>
                          옆에 있던 '까불이'와 다른 친구들도 모두 활발하게 움직이느라 서로 자꾸 쾅쾅 부딪히는 바람에 컵 속이 너무 혼란스러워졌다.
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-amber-600 mb-2 flex items-center gap-1"><Lightbulb className="w-4 h-4" /> 해결 및 과학 원리</label>
                        <div className="bg-amber-50 border border-amber-100 p-5 rounded-xl text-slate-700 text-sm leading-relaxed h-full">
                          '잠보'는 처음엔 당황했지만, 온도가 높을 때는 활발하게 움직이는 것이 자연스러운 규칙임을 깨달았다.<br/><br/>
                          '잠보'는 억지로 멈추려 하기보다 친구들과 박자에 맞춰 신나게 달리기로 했다. 온도가 낮아져 다시 시원해질 때까지 이 활발한 '입자 댄스 파티'를 즐기기로 마음먹으며 갈등이 해결되었다.
                        </div>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                      <label className="text-xs font-bold text-emerald-700 mb-1 block">사용한 과학 원리 한 줄 요약</label>
                      <div className="font-bold text-slate-800">온도가 높아지면 입자의 운동이 활발해지고, 온도가 낮아지면 입자의 운동이 둔해진다.</div>
                    </div>
                  </div>

                  {/* Section 4 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[#2d5a3c] flex items-center gap-2 mb-4">
                      <span className="bg-[#2d5a3c] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span> 핵심 장면 네 컷 만화
                    </h3>
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 text-sm text-slate-600 font-medium">
                      선생님께서 첨부해주신 4컷 만화 이미지입니다.
                    </div>
                    
                    <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                      <img 
                        src="/dance_party_comic.png" 
                        alt="멈출 수 없는 댄스 파티 4컷 만화" 
                        className="w-full h-auto object-contain max-h-[800px] rounded-lg shadow-sm"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden">
                        <div className="w-16 h-16 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-slate-700 font-bold text-lg mb-2">첨부하신 4컷 만화 이미지가 들어갈 자리입니다.</p>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">
                          AI 환경의 제한으로 이미지 파일을 직접 저장할 수 없습니다.<br/>
                          <span className="text-indigo-600 font-bold">public</span> 폴더에 <code className="bg-slate-200 px-1 rounded">dance_party_comic.png</code> 이름으로 이미지를 업로드하시면 여기에 나타납니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Teacher Login Modal */}
      {showTeacherLogin && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600" /> 교사 모드 로그인
            </h3>
            <input 
              type="password" 
              placeholder="비밀번호를 입력하세요" 
              value={teacherPassword}
              onChange={(e) => setTeacherPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTeacherLogin()}
              className="w-full border-2 border-slate-200 rounded-lg px-4 py-2 mb-4 outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowTeacherLogin(false)}
                className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100"
              >
                취소
              </button>
              <button 
                onClick={handleTeacherLogin}
                className="px-4 py-2 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="py-8 px-4 print:py-0 print:px-0">
        {view === 'write' && (
          <div className="max-w-5xl mx-auto">
            {renderWorksheet(formData, false)}
          </div>
        )}
        
        {view === 'detail' && selectedSubmission && (
          <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex justify-between items-center print:hidden">
              <button 
                onClick={() => setView('board')}
                className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold transition-colors"
              >
                <ArrowLeft className="w-5 h-5" /> 게시판으로 돌아가기
              </button>
              {isTeacher && (
                <button 
                  onClick={() => setDeletingSubmission(selectedSubmission)}
                  className="flex items-center gap-2 text-rose-600 hover:text-rose-800 font-bold transition-colors bg-rose-50 px-4 py-2 rounded-full"
                >
                  <Trash2 className="w-5 h-5" /> 게시물 삭제
                </button>
              )}
            </div>
            
            <div className="flex flex-col xl:flex-row gap-8 items-start">
              <div className="flex-1 w-full">
                {renderWorksheet(selectedSubmission, true)}
              </div>
              
              {/* Feedback Sidebar */}
              <div className="w-full xl:w-96 bg-white rounded-2xl shadow-xl p-6 print:hidden sticky top-24 shrink-0">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-6">
                  <MessageSquare className="w-6 h-6 text-indigo-600" /> 친구들의 피드백
                </h3>
                
                <div className="flex flex-col gap-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
                  {feedbacks.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm font-medium bg-slate-50 rounded-xl">
                      아직 피드백이 없습니다.<br/>첫 번째 피드백을 남겨주세요!
                    </div>
                  ) : (
                    feedbacks.map(fb => (
                      <div key={fb.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-slate-700 text-sm">{fb.authorName}</span>
                          <span className="text-xs text-slate-400">
                            {fb.createdAt?.toDate ? fb.createdAt.toDate().toLocaleDateString() : ''}
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm whitespace-pre-wrap">{fb.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <textarea 
                    value={newFeedback}
                    onChange={(e) => setNewFeedback(e.target.value)}
                    placeholder={myInfo.studentName ? "따뜻한 피드백을 남겨주세요!" : "우측 상단에서 학생 정보를 먼저 입력해주세요."}
                    disabled={isSubmittingFeedback}
                    className="w-full h-24 border-2 border-slate-200 rounded-xl p-3 outline-none resize-none bg-slate-50 focus:bg-white focus:border-indigo-300 transition-colors text-sm mb-3 disabled:opacity-50"
                  />
                  <button 
                    onClick={handleFeedbackSubmit}
                    disabled={isSubmittingFeedback || !newFeedback.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" /> {isSubmittingFeedback ? '등록 중...' : '피드백 등록'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'board' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                  <Users className="w-8 h-8 text-indigo-600" /> 1학년 작품 게시판
                </h2>
                <p className="text-slate-500 font-medium mt-2">친구들이 만든 재미있는 입자 스토리보드를 감상해보세요!</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">반 선택:</span>
                <select 
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="border-2 border-slate-300 rounded-lg px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">전체 보기</option>
                  {[...Array(11)].map((_, i) => (
                    <option key={i+1} value={i+1}>{i+1}반</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {submissions
                .filter(sub => selectedClass === 'all' || sub.classNumber === selectedClass)
                .map((sub) => (
                <div 
                  key={sub.id} 
                  onClick={() => { setSelectedSubmission(sub); setView('detail'); }}
                  className="bg-white border-2 border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-indigo-400 hover:shadow-lg transition-all group flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                      1학년 {sub.classNumber}반 {sub.studentNumber}번
                    </span>
                    <span className="text-slate-400 text-xs font-medium">
                      {sub.createdAt?.toDate ? sub.createdAt.toDate().toLocaleDateString() : ''}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {sub.title || '제목 없음'}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-1">
                    {sub.sciencePrinciple || '과학 원리 요약이 없습니다.'}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                    <span className="font-bold text-slate-700">{sub.studentName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                        캐릭터: {sub.characterName || '이름 없음'}
                      </span>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> {allFeedbacks.filter(fb => fb.worksheetId === sub.id).length}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {submissions.filter(sub => selectedClass === 'all' || sub.classNumber === selectedClass).length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-500 font-medium">
                  아직 등록된 작품이 없습니다. 첫 번째로 제출해보세요!
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'teacher' && isTeacher && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                  <ShieldCheck className="w-8 h-8 text-indigo-600" /> 교사 대시보드
                </h2>
                <p className="text-slate-500 font-medium mt-2">각 반의 제출 현황과 학생들의 피드백 참여도를 확인하세요.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">반 선택:</span>
                <select 
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="border-2 border-slate-300 rounded-lg px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">전체 보기</option>
                  {[...Array(11)].map((_, i) => (
                    <option key={i+1} value={i+1}>{i+1}반</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="p-4 font-bold text-slate-700">반</th>
                      <th className="p-4 font-bold text-slate-700">번호</th>
                      <th className="p-4 font-bold text-slate-700">이름</th>
                      <th className="p-4 font-bold text-slate-700">제출 여부</th>
                      <th className="p-4 font-bold text-slate-700">받은 댓글 수</th>
                      <th className="p-4 font-bold text-slate-700">작성한 댓글 수</th>
                      <th className="p-4 font-bold text-slate-700">댓글 단 게시물</th>
                      <th className="p-4 font-bold text-slate-700">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions
                      .filter(sub => selectedClass === 'all' || sub.classNumber === selectedClass)
                      .sort((a, b) => {
                        if (a.classNumber !== b.classNumber) return a.classNumber - b.classNumber;
                        return a.studentNumber - b.studentNumber;
                      })
                      .map((sub) => {
                        // Count feedbacks received on this post
                        const receivedCount = allFeedbacks.filter(fb => fb.worksheetId === sub.id).length;
                        
                        // Count feedbacks given by this student (using authorUid)
                        const userFeedbacks = allFeedbacks.filter(fb => fb.authorUid === sub.authorUid);
                        const feedbackCount = userFeedbacks.length;
                        
                        // Get unique student numbers of the posts they commented on
                        const commentedPosts = Array.from(new Set(userFeedbacks.map(fb => {
                          const ws = submissions.find(s => s.id === fb.worksheetId);
                          return ws ? `${ws.classNumber}-${ws.studentNumber}` : null;
                        }).filter(Boolean))).map(id => {
                          const [c, s] = (id as string).split('-');
                          return `${c}반 ${s}번`;
                        }).join(', ');

                        return (
                          <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-medium text-slate-600">{sub.classNumber}반</td>
                            <td className="p-4 font-medium text-slate-600">{sub.studentNumber}번</td>
                            <td className="p-4 font-bold text-slate-800">{sub.studentName}</td>
                            <td className="p-4">
                              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded">제출 완료</span>
                            </td>
                            <td className="p-4 font-medium text-indigo-600">{receivedCount}개</td>
                            <td className="p-4 font-medium text-emerald-600">{feedbackCount}번</td>
                            <td className="p-4 text-sm text-slate-500 max-w-xs truncate" title={commentedPosts}>
                              {commentedPosts || '-'}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => {
                                    setEditingStudent(sub);
                                    setEditFormData({ classNumber: sub.classNumber, studentNumber: sub.studentNumber, studentName: sub.studentName });
                                  }}
                                  className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center gap-1"
                                >
                                  <Edit2 className="w-4 h-4" /> 수정
                                </button>
                                <button 
                                  onClick={() => setDeletingSubmission(sub)}
                                  className="text-rose-600 hover:text-rose-800 font-bold text-sm flex items-center gap-1"
                                >
                                  <Trash2 className="w-4 h-4" /> 삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {submissions.filter(sub => selectedClass === 'all' || sub.classNumber === selectedClass).length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                          해당 반에 아직 제출된 작품이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
