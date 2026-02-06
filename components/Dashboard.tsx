import React, { useState, useEffect, useRef } from 'react';
import { User, FoundItem, ChatMessage } from '../types';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadStep, setUploadStep] = useState<'none' | 'preview' | 'vivaChoice' | 'manualViva' | 'thankYou'>('none');
  const [manualQuestions, setManualQuestions] = useState([{ q: '', a: '' }]);
  const [showToast, setShowToast] = useState<{show: boolean, message: string}>({show: false, message: ''});
  const [newlyCreatedItem, setNewlyCreatedItem] = useState<FoundItem | null>(null);
  
  const [selectedItem, setSelectedItem] = useState<FoundItem | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'idle' | 'success' | 'fail' | 'locked'>('idle');
  const [newMessage, setNewMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshData();
    // Auto-refresh every 10 seconds to keep devices in sync
    const interval = setInterval(() => {
      refreshData(false);
    }, 10000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [selectedItem?.messages]);

  const triggerToast = (msg: string) => {
    setShowToast({show: true, message: msg});
    setTimeout(() => setShowToast({show: false, message: ''}), 5000);
  };

  const refreshData = async (showLoading = true) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const cloudItems = await db.getItems();
      setItems(cloudItems.sort((a, b) => b.timestamp - a.timestamp));
      
      if (selectedItem) {
        const fresh = cloudItems.find(it => it.id === selectedItem.id);
        if (!fresh) {
          setSelectedItem(null); // Item was deleted by founder elsewhere
        } else if (JSON.stringify(fresh) !== JSON.stringify(selectedItem)) {
          setSelectedItem(fresh);
        }
      }
    } catch (e) {
      console.error("Master Sync Error", e);
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) { alert("Enable camera permissions for HONESTA."); }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx?.drawImage(videoRef.current, 0, 0);
      setCapturedImage(canvasRef.current.toDataURL('image/jpeg', 0.8));
      setUploadStep('preview');
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const finalizeUpload = async (useAI: boolean) => {
    if (!capturedImage) return;
    setIsUploading(true);
    try {
      const [bwImage, compressedOrig] = await Promise.all([
        convertToBlackAndWhite(capturedImage),
        compressOriginalImage(capturedImage)
      ]);
      
      let title = "Found Item";
      let questions: string[] = [];
      let answers: string[] = [];

      if (useAI) {
        try {
          const aiData = await generateVerificationQuestions(capturedImage);
          title = aiData.title || "Found Item";
          questions = aiData.questions || ["Describe the item."];
          answers = aiData.answers || [""];
        } catch (aiErr) {
          console.error("AI Error:", aiErr);
          throw new Error("AI analysis timed out. Use manual questions.");
        }
      } else {
        questions = manualQuestions.map(m => m.q);
        answers = manualQuestions.map(m => m.a);
      }

      const itemId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const newItem: FoundItem = {
        id: itemId,
        title,
        imageUrl: bwImage, 
        originalImageUrl: compressedOrig,
        founderId: user.id,
        founderName: user.fullName,
        founderPhone: user.phoneNumber,
        timestamp: Date.now(),
        status: 'available',
        verificationQuestions: questions,
        verificationAnswers: answers,
        messages: []
      };
      
      await db.saveItem(newItem);
      setNewlyCreatedItem(newItem);
      await refreshData();
      setUploadStep('thankYou');
      triggerToast("Broadcast Successful! ✅");
    } catch (err: any) { 
      console.error("Finalize Error:", err);
      alert(err.message || "Cloud Sync Failed. Check network."); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleClaim = async () => {
    if (!selectedItem) return;
    setIsVerifying(true);
    try {
      const isCorrect = await verifyAnswers(selectedItem.verificationQuestions, userAnswers, selectedItem.verificationAnswers);
      if (isCorrect) setVerificationResult('success');
      else setVerificationResult('fail');
    } catch (err) {
      alert("Verification system busy. Try manual matching via founder contact.");
    } finally {
      setIsVerifying(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedItem || !newMessage.trim() || selectedItem.status === 'handovered') return;
    const msg: ChatMessage = { senderId: user.id, senderName: user.fullName, text: newMessage, timestamp: Date.now() };
    const updatedItem = { ...selectedItem, messages: [...selectedItem.messages, msg] };
    setSelectedItem(updatedItem);
    setNewMessage('');
    await db.updateItem(updatedItem);
    await refreshData(false);
  };

  const markAsHandovered = async (itemToUpdate?: FoundItem) => {
    const item = itemToUpdate || selectedItem;
    if (!item) return;
    
    if (confirm("Mark this item as successfully returned? ✅")) {
      setIsRefreshing(true);
      try {
        const updatedItem: FoundItem = { ...item, status: 'handovered' };
        await db.updateItem(updatedItem);
        setItems(prev => prev.map(i => i.id === item.id ? updatedItem : i));
        if (selectedItem?.id === item.id) setSelectedItem(updatedItem);
        triggerToast("Status Updated! ✅");
      } catch (err) {
        alert("Failed to update status. Check internet.");
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const handleDeletePost = async (itemId: string) => {
    if (confirm("Permanently delete this report? 🗑️")) {
      setIsRefreshing(true);
      try {
        await db.deleteItem(itemId);
        setItems(prev => prev.filter(i => i.id !== itemId));
        if (selectedItem?.id === itemId) setSelectedItem(null);
        if (newlyCreatedItem?.id === itemId) {
          setNewlyCreatedItem(null);
          setUploadStep('none');
        }
        triggerToast("Report Removed 🗑️");
      } catch (err) {
        alert("Delete failed. Check cloud link.");
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {showToast.show && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-top-4">
          <div className="bg-gray-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center space-x-3 border border-white/10">
            <span className="font-black text-sm uppercase tracking-widest">{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Cloud Sync Status Indicator */}
      <div className={`fixed bottom-8 left-8 flex items-center space-x-2 px-4 py-2 bg-white/80 backdrop-blur rounded-full shadow-sm border border-gray-100 z-50 transition-opacity ${isRefreshing ? 'opacity-100' : 'opacity-40'}`}>
        <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'}`}></div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          {isRefreshing ? 'Cloud Syncing...' : 'Network Live'}
        </span>
      </div>

      <div className="mb-14 relative max-w-2xl mx-auto">
        <input
          type="text" placeholder="Search Master Feed..."
          className="w-full pl-16 pr-8 py-6 bg-white border-2 border-gray-50 rounded-[2.5rem] shadow-xl focus:ring-4 focus:ring-indigo-500/10 outline-none text-xl font-bold transition-all"
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        />
        <svg className="w-6 h-6 absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <div className="bg-white p-8 rounded-[3.5rem] shadow-2xl border-t-[8px] border-indigo-600 sticky top-24">
            <h3 className="text-2xl font-black text-gray-900 mb-8 tracking-tighter">Honesty Center</h3>
            
            {uploadStep === 'none' && !showCamera && (
              <div className="space-y-4">
                <button onClick={startCamera} className="w-full flex items-center justify-between bg-indigo-600 hover:bg-indigo-700 text-white font-black p-6 rounded-[2rem] shadow-lg transition-all active:scale-95 group">
                  <span className="text-xl tracking-tighter">Camera Scan</span>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="3"/></svg>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-between bg-gray-50 text-indigo-800 font-black p-6 rounded-[2rem] transition-all hover:bg-indigo-50 border-2 border-dashed border-gray-200">
                  <span className="text-lg tracking-tighter">Choose Image</span>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth="3"/></svg>
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
              <div className="space-y-4 animate-in zoom-in-95">
                <div className="relative rounded-[2.5rem] overflow-hidden bg-black aspect-square shadow-inner">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                </div>
                <button onClick={capturePhoto} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black shadow-lg text-lg">Capture</button>
                <button onClick={stopCamera} className="w-full text-gray-400 py-2 font-black text-[10px] uppercase tracking-widest">Cancel</button>
              </div>
            )}

            {uploadStep === 'preview' && capturedImage && (
              <div className="space-y-6 animate-in fade-in">
                <div className="relative rounded-[2.5rem] overflow-hidden shadow-inner aspect-square border border-gray-100">
                  <img src={capturedImage} className="w-full h-full object-cover" />
                </div>
                <button onClick={() => setUploadStep('vivaChoice')} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black shadow-lg text-lg">Next</button>
                <button onClick={() => { setUploadStep('none'); setCapturedImage(null); }} className="w-full text-gray-400 py-2 font-black text-[10px] uppercase tracking-widest">Discard</button>
              </div>
            )}

            {uploadStep === 'vivaChoice' && (
              <div className="space-y-4 text-center py-4">
                <h4 className="font-black text-gray-900 uppercase text-[10px] tracking-widest mb-4">Ownership Sync</h4>
                <div className="flex flex-col gap-3">
                  <button onClick={() => setUploadStep('manualViva')} className="bg-white border-2 border-indigo-600 text-indigo-600 py-5 rounded-[2rem] font-black text-sm hover:bg-indigo-50 transition-all">Manual Questions</button>
                  <button onClick={() => finalizeUpload(true)} disabled={isUploading} className="bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-sm shadow-lg hover:bg-indigo-700 disabled:opacity-50">
                    {isUploading ? 'Analyzing...' : 'AI Intelligent Scan'}
                  </button>
                </div>
              </div>
            )}

            {uploadStep === 'manualViva' && (
              <div className="space-y-4 animate-in fade-in">
                {manualQuestions.map((mq, idx) => (
                  <div key={idx} className="space-y-2 p-4 bg-gray-50 rounded-[2rem] border border-gray-100">
                    <input type="text" placeholder="Question" className="w-full bg-white px-4 py-3 rounded-xl border-none outline-none font-bold text-xs shadow-sm"
                      value={mq.q} onChange={e => { const n = [...manualQuestions]; n[idx].q = e.target.value; setManualQuestions(n); }} />
                    <input type="text" placeholder="Answer" className="w-full bg-white px-4 py-3 rounded-xl border-none outline-none font-bold text-xs shadow-sm"
                      value={mq.a} onChange={e => { const n = [...manualQuestions]; n[idx].a = e.target.value; setManualQuestions(n); }} />
                  </div>
                ))}
                <button onClick={() => setManualQuestions([...manualQuestions, { q: '', a: '' }])} className="text-[10px] font-black text-indigo-500 py-1 w-full text-center hover:underline">+ Add Another Challenge</button>
                <button onClick={() => finalizeUpload(false)} disabled={isUploading || manualQuestions.some(m => !m.q || !m.a)} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black shadow-lg text-lg">
                  {isUploading ? 'Securing...' : 'Publish Report'}
                </button>
              </div>
            )}

            {uploadStep === 'thankYou' && newlyCreatedItem && (
              <div className="text-center py-6 animate-in zoom-in">
                <div className="w-20 h-20 bg-green-50 text-green-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h4 className="text-3xl font-black text-gray-900 mb-2">Item Reported</h4>
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-8 leading-relaxed">Broadcasted to CMRIT Network</p>
                
                <div className="space-y-3">
                  <button onClick={() => { setUploadStep('none'); setCapturedImage(null); setNewlyCreatedItem(null); refreshData(); }} className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-black transition-all">Done</button>
                  <button onClick={() => handleDeletePost(newlyCreatedItem.id)} className="w-full py-4 bg-red-50 text-red-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100">Delete Post 🗑️</button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-3xl font-black text-gray-900 tracking-tighter">Campus Feed</h3>
            <button onClick={() => refreshData()} className="flex items-center space-x-2 bg-indigo-50 text-indigo-600 px-6 py-3 rounded-full hover:bg-indigo-100 transition-all">
              <span className="text-[10px] font-black uppercase tracking-widest">Manual Refresh</span>
              <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          </div>

          {items.length === 0 && !isRefreshing && (
            <div className="bg-white rounded-[3.5rem] p-20 text-center border border-dashed border-gray-200">
              <p className="text-gray-400 font-black text-lg uppercase tracking-widest">No Items Reported Yet</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {items.filter(it => it.title.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
              <div key={item.id} className={`bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-gray-50 flex flex-col group transition-all duration-500 ${item.status === 'handovered' ? 'opacity-60 grayscale-[0.3]' : 'hover:-translate-y-2'}`}>
                <div className="relative aspect-square overflow-hidden bg-black">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  
                  {item.status === 'available' ? (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm p-8">
                      <button onClick={() => { setSelectedItem(item); setUserAnswers(new Array(item.verificationQuestions.length).fill('')); setVerificationResult('idle'); }} className="w-full bg-white text-gray-900 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl">Verify Ownership</button>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-green-600/80 flex items-center justify-center p-6 backdrop-blur">
                      <div className="text-center rotate-[-4deg] border-4 border-white px-8 py-4 rounded-[2rem] shadow-2xl">
                        <span className="text-white font-black text-2xl block uppercase tracking-tighter">RETURNED ✅</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute top-6 left-6">
                    <span className="bg-black/50 backdrop-blur-lg text-white px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border border-white/20">{item.title}</span>
                  </div>
                </div>
                
                <div className="p-8 flex-grow flex flex-col justify-between">
                  <div>
                    <p className="text-xl font-black text-gray-900 tracking-tight mb-1">Found by {item.founderName}</p>
                    <div className="flex items-center justify-between opacity-50">
                      <p className="text-[10px] font-black uppercase">ID: {item.id}</p>
                      <p className="text-[10px] font-bold uppercase">{new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {item.founderId.toUpperCase() === user.id.toUpperCase() && (
                    <div className="mt-6 pt-4 border-t border-gray-50 flex flex-col gap-3">
                      <div className="text-center">
                         <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Founder Controls</span>
                      </div>
                      {item.status === 'available' && (
                        <button onClick={() => markAsHandovered(item)} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all">Confirm Handover ✅</button>
                      )}
                      <button onClick={() => handleDeletePost(item.id)} className="w-full bg-red-50 text-red-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all">Delete Post 🗑️</button>
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
          <div className="bg-white w-full max-w-xl rounded-[4rem] p-10 max-h-[90vh] overflow-y-auto relative shadow-2xl border border-gray-100">
            <button onClick={() => setSelectedItem(null)} className="absolute top-8 right-8 p-4 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-full transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            {verificationResult === 'idle' && selectedItem.founderId.toUpperCase() !== user.id.toUpperCase() && selectedItem.status === 'available' && (
              <div className="space-y-8 py-4">
                <div className="text-center">
                  <h4 className="text-3xl font-black text-gray-900 mb-2">Ownership Challenge</h4>
                  <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Verify identity to contact founder</p>
                </div>
                {selectedItem.verificationQuestions.map((q, idx) => (
                  <div key={idx} className="space-y-3">
                    <p className="text-lg font-bold text-gray-800 px-2">{q}</p>
                    <input type="text" className="w-full px-8 py-5 bg-gray-50 border-2 border-gray-100 rounded-[1.5rem] outline-none text-xl font-black shadow-inner focus:border-indigo-500/30 transition-all" placeholder="Enter Answer..."
                      value={userAnswers[idx]} onChange={(e) => { const n = [...userAnswers]; n[idx] = e.target.value; setUserAnswers(n); }} />
                  </div>
                ))}
                <button onClick={handleClaim} disabled={isVerifying || userAnswers.some(a => !a.trim())} className="w-full bg-indigo-600 text-white font-black py-6 rounded-[2rem] shadow-xl text-xl tracking-tighter">
                  {isVerifying ? 'Authenticating...' : 'Validate Answers'}
                </button>
              </div>
            )}

            {(verificationResult === 'success' || selectedItem.founderId.toUpperCase() === user.id.toUpperCase() || selectedItem.status === 'handovered') && (
              <div className="flex flex-col h-[75vh] animate-in slide-in-from-bottom-8">
                <div className="flex-shrink-0 text-center pb-8 border-b border-gray-100">
                  <h5 className="text-3xl font-black text-gray-900 tracking-tighter mb-4">Secure Messaging</h5>
                  <div className="flex items-center justify-center space-x-3 bg-indigo-50 px-6 py-3 rounded-full mx-auto w-fit">
                     <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeWidth="3"/></svg>
                     <span className="text-sm font-black text-indigo-700">{selectedItem.founderPhone}</span>
                  </div>
                </div>
                
                <div className="flex-grow overflow-y-auto py-8 space-y-6 px-4">
                  {selectedItem.messages.length === 0 ? (
                    <div className="text-center py-20">
                      <p className="text-gray-400 font-bold text-sm">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    selectedItem.messages.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.senderId === user.id ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[80%] px-6 py-4 rounded-[2rem] shadow-sm ${m.senderId === user.id ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'}`}>
                          <p className="text-md font-bold">{m.text}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-2 font-black uppercase tracking-widest px-2">{m.senderName}</span>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {selectedItem.status === 'available' ? (
                  <div className="flex-shrink-0 pt-4 flex space-x-3">
                    <input type="text" className="flex-grow px-8 py-5 bg-gray-50 border-2 border-gray-100 rounded-[2rem] outline-none font-black text-lg focus:border-indigo-500/20 shadow-inner" placeholder="Type a message..."
                      value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
                    <button onClick={sendMessage} className="bg-indigo-600 text-white w-20 rounded-[2rem] shadow-xl flex items-center justify-center active:scale-95 transition-all">
                      <svg className="w-8 h-8 rotate-45" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-green-50 text-green-700 rounded-[2rem] font-black uppercase text-xs tracking-widest border border-green-100">Item successfully returned - Chat Locked ✅</div>
                )}
              </div>
            )}

            {verificationResult === 'fail' && (
              <div className="text-center py-20 animate-in zoom-in-95">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="4"/></svg>
                </div>
                <h5 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Access Denied</h5>
                <p className="text-gray-400 font-bold px-8 leading-relaxed mb-10 uppercase tracking-widest text-xs">Integrity check failed. You do not seem to be the owner of this item.</p>
                <button onClick={() => setVerificationResult('idle')} className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-black transition-all">Try Again</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;