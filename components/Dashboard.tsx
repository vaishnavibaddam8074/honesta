import React, { useState, useEffect, useRef } from 'react';
import { User, FoundItem, ChatMessage, AttemptLog } from '../types';
import { convertToBlackAndWhite, compressOriginalImage } from '../utils/imageUtils';
import { generateVerificationQuestions, verifyAnswers } from '../services/geminiService';
import { db } from '../services/db';

interface DashboardProps { user: User; }

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [items, setItems] = useState<FoundItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadStep, setUploadStep] = useState<'none' | 'preview' | 'vivaChoice' | 'manualViva' | 'thankYou'>('none');
  const [manualQuestions, setManualQuestions] = useState([{ q: '', a: '' }]);
  const [showToast, setShowToast] = useState<{show: boolean, message: string}>({show: false, message: ''});
  
  const [selectedItem, setSelectedItem] = useState<FoundItem | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'idle' | 'success' | 'fail' | 'locked'>('idle');
  const [lockoutInfo, setLockoutInfo] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => refreshData(false), 10000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [selectedItem?.messages]);

  const triggerToast = (msg: string) => {
    setShowToast({show: true, message: msg});
    setTimeout(() => setShowToast({show: false, message: ''}), 4000);
  };

  const refreshData = async (showLoading = true) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const cloudItems = await db.getItems();
      const sorted = [...cloudItems].sort((a, b) => b.timestamp - a.timestamp);
      setItems(sorted);
      if (selectedItem) {
        const fresh = cloudItems.find(it => it.id === selectedItem.id);
        if (!fresh) setSelectedItem(null);
        else if (JSON.stringify(fresh.messages) !== JSON.stringify(selectedItem.messages)) {
          setSelectedItem(fresh);
        }
      }
    } catch (e) {
      console.error("Refresh Error", e);
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  const getAttemptKey = (itemId: string) => `honesta_viva_${user.id}_${itemId}`;

  const checkLockout = (itemId: string): boolean => {
    const logStr = localStorage.getItem(getAttemptKey(itemId));
    if (!logStr) return false;
    
    const log: AttemptLog = JSON.parse(logStr);
    const twoHours = 2 * 60 * 60 * 1000;
    const timePassed = Date.now() - log.lastAttemptTime;

    if (log.count >= 3 && timePassed < twoHours) {
      const remainingMinutes = Math.ceil((twoHours - timePassed) / (60 * 1000));
      setLockoutInfo(`${remainingMinutes} minutes`);
      setVerificationResult('locked');
      return true;
    }
    
    if (timePassed >= twoHours) {
      localStorage.removeItem(getAttemptKey(itemId));
    }
    return false;
  };

  const recordFailedAttempt = (itemId: string) => {
    const logStr = localStorage.getItem(getAttemptKey(itemId));
    let log: AttemptLog = logStr ? JSON.parse(logStr) : { count: 0, lastAttemptTime: Date.now() };
    
    log.count += 1;
    log.lastAttemptTime = Date.now();
    localStorage.setItem(getAttemptKey(itemId), JSON.stringify(log));
    
    if (log.count >= 3) {
      setLockoutInfo("2 hours");
      setVerificationResult('locked');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) { 
      alert("Camera access denied. Enable permissions in settings."); 
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
      setCapturedImage(dataUrl);
      setUploadStep('preview');
      stopCamera();
    }
  };

  const finalizeUpload = async (useAI: boolean) => {
    if (!capturedImage) return;
    setIsUploading(true);
    setUploadProgress('Starting AI analysis...');
    
    let aiData;
    
    try {
      if (useAI) {
        aiData = await generateVerificationQuestions(capturedImage);
      } else {
        const limitedManual = manualQuestions.slice(0, 3);
        aiData = {
          title: "Found Item",
          questions: limitedManual.map(m => m.q),
          answers: limitedManual.map(m => m.a)
        };
      }
      
      setUploadProgress('Compressing images for network...');
      const [bwImage, compressedOrig] = await Promise.all([
        convertToBlackAndWhite(capturedImage),
        compressOriginalImage(capturedImage)
      ]);
      
      setUploadProgress('Syncing to CMRIT Feed...');
      const itemId = Math.random().toString(36).substr(2, 6).toUpperCase();
      const newItem: FoundItem = {
        id: itemId,
        title: aiData.title || "Found Item",
        imageUrl: bwImage, 
        originalImageUrl: compressedOrig,
        founderId: user.id,
        founderName: user.fullName,
        founderPhone: user.phoneNumber,
        timestamp: Date.now(),
        status: 'available',
        verificationQuestions: aiData.questions.length > 0 ? aiData.questions : ["Describe the item."],
        verificationAnswers: aiData.answers.length > 0 ? aiData.answers : ["any"],
        messages: []
      };
      
      await db.saveItem(newItem);
      setUploadStep('thankYou');
      triggerToast("Post Live on CMRIT Feed! ✅");
      refreshData(false);
    } catch (err: any) { 
      console.error("Reporting Error", err);
      alert("Network Sync Failed: Campus Wi-Fi might be slow. Please wait a moment and try again."); 
    } finally { 
      setIsUploading(false); 
      setUploadProgress('');
    }
  };

  const handleClaim = async () => {
    if (!selectedItem) return;
    if (checkLockout(selectedItem.id)) return;

    setIsVerifying(true);
    try {
      const isCorrect = await verifyAnswers(selectedItem.verificationQuestions, userAnswers, selectedItem.verificationAnswers);
      if (isCorrect) {
        setVerificationResult('success');
        localStorage.removeItem(getAttemptKey(selectedItem.id));
      } else {
        setVerificationResult('fail');
        recordFailedAttempt(selectedItem.id);
      }
    } catch (err) { 
      alert("Verification server timed out. Check connection."); 
    } finally { 
      setIsVerifying(false); 
    }
  };

  const sendMessage = async () => {
    if (!selectedItem || !newMessage.trim()) return;
    const msg: ChatMessage = { senderId: user.id, senderName: user.fullName, text: newMessage, timestamp: Date.now() };
    const updatedItem = { ...selectedItem, messages: [...selectedItem.messages, msg] };
    setSelectedItem(updatedItem);
    setNewMessage('');
    await db.updateItem(updatedItem);
    await refreshData(false);
  };

  const markAsHandovered = async (itemToUpdate: FoundItem) => {
    if (confirm("Confirm: Has this item been returned safely?")) {
      try {
        const updatedItem: FoundItem = { ...itemToUpdate, status: 'handovered' };
        await db.updateItem(updatedItem);
        triggerToast("Triumph! Honesty makes CMRIT better. 🌟");
        await refreshData();
      } catch (e) {
        alert("Sync error. Try again.");
      }
    }
  };

  const handleDeletePost = async (itemId: string) => {
    if (confirm("Delete this report forever?")) {
      try {
        await db.deleteItem(itemId);
        await refreshData();
        if (selectedItem?.id === itemId) setSelectedItem(null);
      } catch (e) {
        alert("Delete failed.");
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {showToast.show && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4">
          <div className="bg-gray-900 text-white px-8 py-3 rounded-full shadow-2xl border border-white/10 font-black text-xs uppercase tracking-widest">
            {showToast.message}
          </div>
        </div>
      )}

      <div className={`fixed bottom-8 left-8 flex items-center space-x-2 px-4 py-2 bg-white/90 backdrop-blur rounded-full shadow-lg border border-gray-100 z-50`}>
        <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'}`}></div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          {isRefreshing ? 'Syncing...' : 'CMRIT Online'}
        </span>
      </div>

      <div className="mb-14 max-w-2xl mx-auto">
        <input
          type="text" placeholder="Search the feed..."
          className="w-full px-8 py-6 bg-white border-2 border-gray-50 rounded-[2.5rem] shadow-xl outline-none text-xl font-bold transition-all focus:border-indigo-100"
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <div className="bg-white p-8 rounded-[3.5rem] shadow-2xl border-t-[8px] border-indigo-600 sticky top-24">
            <h3 className="text-2xl font-black text-gray-900 mb-8 tracking-tighter uppercase">Reporting Hub</h3>
            
            {uploadStep === 'none' && !showCamera && (
              <div className="space-y-4">
                <button onClick={startCamera} className="w-full flex items-center justify-between bg-indigo-600 text-white font-black p-6 rounded-[2rem] shadow-lg active:scale-95 transition-all">
                  <span className="text-lg uppercase">Scan Item</span>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black text-gray-300"><span className="bg-white px-2 tracking-widest">or</span></div>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-between bg-gray-50 text-indigo-800 font-black p-6 rounded-[2rem] border-2 border-dashed border-gray-200 hover:bg-indigo-50 transition-all">
                  <span className="text-lg uppercase">From Gallery</span>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </button>
                <input type="file" ref={fileInputRef} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const r = new FileReader();
                    r.onload = (ev) => { setCapturedImage(ev.target?.result as string); setUploadStep('preview'); };
                    r.readAsDataURL(file);
                  }
                }} accept="image/*" className="hidden" />
              </div>
            )}

            {showCamera && (
              <div className="space-y-4 animate-in fade-in zoom-in-95">
                <div className="relative rounded-[2.5rem] overflow-hidden bg-black aspect-square shadow-2xl border-4 border-indigo-600/20">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                </div>
                <button onClick={capturePhoto} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black shadow-xl text-xl uppercase tracking-tighter active:scale-95 transition-all">Capture Now</button>
                <button onClick={stopCamera} className="w-full text-gray-400 py-2 font-black text-[10px] uppercase tracking-widest text-center">Cancel</button>
              </div>
            )}

            {uploadStep === 'preview' && capturedImage && (
              <div className="space-y-6 animate-in zoom-in-95">
                <div className="relative rounded-[2.5rem] overflow-hidden aspect-square border border-gray-50 shadow-inner">
                  <img src={capturedImage} className="w-full h-full object-cover" />
                </div>
                <button onClick={() => setUploadStep('vivaChoice')} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black shadow-lg text-lg uppercase tracking-tighter">Analyze Item</button>
                <button onClick={() => { setUploadStep('none'); setCapturedImage(null); }} className="w-full text-gray-400 py-2 font-black text-[10px] uppercase tracking-widest text-center">Discard</button>
              </div>
            )}

            {uploadStep === 'vivaChoice' && (
              <div className="space-y-4 text-center py-4">
                <h4 className="font-black text-gray-900 uppercase text-[10px] tracking-widest mb-6">Verification Method</h4>
                <button onClick={() => finalizeUpload(true)} disabled={isUploading} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-sm shadow-lg disabled:opacity-50 hover:bg-indigo-700 transition-all flex flex-col items-center justify-center">
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                       <span className="animate-pulse mb-1">Processing...</span>
                       <span className="text-[8px] opacity-70 tracking-widest uppercase">{uploadProgress}</span>
                    </div>
                  ) : (
                    <span>AI Intelligent Viva</span>
                  )}
                </button>
                <button onClick={() => setUploadStep('manualViva')} className="w-full bg-white border-2 border-indigo-600 text-indigo-600 py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest">Manual Setup</button>
              </div>
            )}

            {uploadStep === 'manualViva' && (
              <div className="space-y-4">
                <h4 className="font-black text-gray-900 uppercase text-[10px] tracking-widest text-center mb-2">Set 2-3 Questions</h4>
                {manualQuestions.map((mq, idx) => (
                  <div key={idx} className="space-y-2 p-4 bg-gray-50 rounded-[2rem] border border-gray-100">
                    <input type="text" placeholder="Question (e.g. Color?)" className="w-full bg-white px-4 py-3 rounded-xl font-bold text-xs outline-none"
                      value={mq.q} onChange={e => { const n = [...manualQuestions]; n[idx].q = e.target.value; setManualQuestions(n); }} />
                    <input type="text" placeholder="Secret Answer" className="w-full bg-white px-4 py-3 rounded-xl font-bold text-xs outline-none"
                      value={mq.a} onChange={e => { const n = [...manualQuestions]; n[idx].a = e.target.value; setManualQuestions(n); }} />
                  </div>
                ))}
                {manualQuestions.length < 3 && (
                  <button onClick={() => setManualQuestions([...manualQuestions, { q: '', a: '' }])} className="text-[10px] font-black text-indigo-500 py-1 w-full uppercase tracking-widest">+ Add Field</button>
                )}
                <button onClick={() => finalizeUpload(false)} disabled={isUploading || manualQuestions.some(m => !m.q || !m.a)} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black shadow-lg uppercase tracking-tighter">
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                      <span className="animate-pulse mb-1">Publishing...</span>
                      <span className="text-[8px] opacity-70 tracking-widest uppercase">{uploadProgress}</span>
                    </div>
                  ) : 'Finish Report'}
                </button>
              </div>
            )}

            {uploadStep === 'thankYou' && (
              <div className="text-center py-10 animate-in zoom-in-95">
                <div className="w-24 h-24 bg-green-50 text-green-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h4 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Broadcasted!</h4>
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-10 leading-relaxed px-4">Thank you for your honesty, {user.fullName}. Your report is live for the CMRIT community.</p>
                <button onClick={() => { setUploadStep('none'); setCapturedImage(null); setManualQuestions([{q:'',a:''}]); refreshData(); }} className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl hover:bg-black transition-all">Return to Feed</button>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {items.filter(it => it.title.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
              <div key={item.id} className={`bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-gray-50 flex flex-col transition-all duration-300 ${item.status === 'handovered' ? 'opacity-40 grayscale' : 'hover:-translate-y-2'}`}>
                <div className="relative aspect-square bg-black overflow-hidden">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  {item.status === 'available' ? (
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center p-8 backdrop-blur-sm">
                      <button onClick={() => { 
                        setSelectedItem(item); 
                        setUserAnswers(new Array(item.verificationQuestions.length).fill('')); 
                        setVerificationResult('idle'); 
                        checkLockout(item.id);
                      }} className="w-full bg-white text-gray-900 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl">Claim Ownership</button>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-green-600/80 flex items-center justify-center p-6 backdrop-blur">
                       <span className="text-white font-black text-xl border-4 border-white px-6 py-2 rounded-2xl rotate-[-5deg] shadow-2xl uppercase text-center">Safe Handover ✅</span>
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">{item.title}</span>
                  </div>
                </div>
                <div className="p-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xl font-black text-gray-900 tracking-tighter">Founder: {item.founderName}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  {item.founderId === user.id && (
                    <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col gap-3">
                      {item.status === 'available' && (
                        <button onClick={() => markAsHandovered(item)} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-green-700">Confirm Return ✅</button>
                      )}
                      <button onClick={() => handleDeletePost(item.id)} className="w-full bg-red-50 text-red-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-100 hover:bg-red-100">Remove Post 🗑️</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[200] p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[4rem] p-10 max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <button onClick={() => setSelectedItem(null)} className="absolute top-8 right-8 p-4 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-full transition-all">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            {verificationResult === 'idle' && selectedItem.founderId !== user.id && (
              <div className="space-y-8 py-4">
                <div className="text-center">
                  <h4 className="text-3xl font-black text-gray-900 tracking-tighter">Ownership Viva</h4>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2">Maximum 3 tries allowed</p>
                </div>
                {selectedItem.verificationQuestions.map((q, idx) => (
                  <div key={idx} className="space-y-3">
                    <p className="font-black text-gray-800 text-lg px-2">{q}</p>
                    <input type="text" className="w-full px-8 py-5 bg-gray-50 border-2 border-gray-100 rounded-[1.5rem] outline-none font-bold text-xl shadow-inner focus:border-indigo-500/20 transition-all" placeholder="Enter answer..."
                      value={userAnswers[idx]} onChange={(e) => { const n = [...userAnswers]; n[idx] = e.target.value; setUserAnswers(n); }} />
                  </div>
                ))}
                <button onClick={handleClaim} disabled={isVerifying || userAnswers.some(a => !a.trim())} className="w-full bg-indigo-600 text-white font-black py-6 rounded-[2rem] shadow-xl text-xl tracking-tighter uppercase">
                  {isVerifying ? 'Authenticating...' : 'Verify Me'}
                </button>
              </div>
            )}

            {verificationResult === 'locked' && (
              <div className="text-center py-20 animate-in zoom-in-95">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5"/></svg>
                </div>
                <h5 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Access Denied</h5>
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-2 leading-relaxed">Security policy: Too many failed attempts.</p>
                <p className="text-indigo-600 font-black uppercase text-xs tracking-widest">Retry in: {lockoutInfo}</p>
                <button onClick={() => setSelectedItem(null)} className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black mt-14 shadow-2xl hover:bg-black transition-all uppercase tracking-widest text-sm text-center">Close</button>
              </div>
            )}

            {(verificationResult === 'success' || selectedItem.founderId === user.id || selectedItem.status === 'handovered') && (
              <div className="flex flex-col h-[75vh] animate-in slide-in-from-bottom-8">
                <div className="text-center pb-8 border-b border-gray-100">
                  <h5 className="text-3xl font-black text-gray-900 tracking-tighter">Direct Connect</h5>
                  <div className="bg-indigo-50 text-indigo-700 px-8 py-3 rounded-full inline-block mt-4 font-black text-sm tracking-widest shadow-sm">{selectedItem.founderPhone}</div>
                </div>
                <div className="flex-grow overflow-y-auto py-8 space-y-4 px-4">
                  {selectedItem.messages.map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.senderId === user.id ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] px-6 py-4 rounded-[2rem] shadow-sm ${m.senderId === user.id ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'}`}>
                        <p className="font-bold text-md leading-tight">{m.text}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-2 uppercase font-black tracking-widest px-2">{m.senderName}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                {selectedItem.status === 'available' ? (
                  <div className="pt-4 flex space-x-3">
                    <input type="text" className="flex-grow px-8 py-5 bg-gray-50 border-2 border-gray-100 rounded-[2rem] outline-none font-black text-lg shadow-inner" placeholder="Send a message..."
                      value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
                    <button onClick={sendMessage} className="bg-indigo-600 text-white w-20 rounded-[2rem] shadow-xl flex items-center justify-center active:scale-90 transition-all">
                      <svg className="w-8 h-8 rotate-45" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-green-50 text-green-700 rounded-[2rem] font-black uppercase text-xs tracking-widest border border-green-100">Item Successfully Returned ✅</div>
                )}
              </div>
            )}

            {verificationResult === 'fail' && (
              <div className="text-center py-20 animate-in zoom-in-95">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="4"/></svg>
                </div>
                <h5 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Wrong Answer</h5>
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Ownership verification failed. Attempt recorded.</p>
                <button onClick={() => setVerificationResult('idle')} className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black mt-14 shadow-2xl hover:bg-black transition-all uppercase tracking-widest text-sm">Retry Carefully</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;