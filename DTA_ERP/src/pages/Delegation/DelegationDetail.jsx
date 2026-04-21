import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { API_BASE_URL } from "../../config";
import MainLayout from "../../components/layout/MainLayout";
import Loader from "../../components/common/Loader";
import { fetchDelegationById, updateDelegationStatus, addDelegationRemark } from "../../store/slices/delegationSlice";
import toast from "react-hot-toast";

const DelegationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";
  
  const cached = useSelector((s) => s.delegation.delegationsById[id]);
  const [delegation, setDelegation] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);
  
  // Status Logic
  const [selectedStatus, setSelectedStatus] = useState("");
  const [remark, setRemark] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [revisedDueDate, setRevisedDueDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    dispatch(fetchDelegationById(id)).unwrap()
      .then(d => { setDelegation(d); setLoading(false); })
      .catch(() => { toast.error("Failed to load details"); setLoading(false); });
  }, [id, dispatch]);

  if (loading) return (
    <MainLayout title="Task Intel">
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader className="w-24 h-24" />
        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.3em] text-[#137fec] animate-pulse">Synchronizing Data...</p>
      </div>
    </MainLayout>
  );

  if (!delegation) return (
    <MainLayout title="Error">
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <span className="material-symbols-outlined text-6xl text-slate-300">error</span>
        <h2 className="text-xl font-black text-slate-400 uppercase mt-4">Mission Data Not Found</h2>
        <button onClick={() => navigate("/tasks/my-tasks")} className="mt-6 px-8 py-3 bg-[#137fec] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Back to Hub</button>
      </div>
    </MainLayout>
  );

  const handleUpdate = async () => {
    if (!selectedStatus && !remark.trim()) {
      toast.error("Please select a status or add a remark");
      return;
    }
    setIsUpdating(true);
    try {
      if (selectedStatus) {
        await dispatch(updateDelegationStatus({ id, status: selectedStatus, remark, due_date: revisedDueDate })).unwrap();
        toast.success("Status updated");
      } else {
        await dispatch(addDelegationRemark({ id, remark })).unwrap();
        toast.success("Remark added");
      }
      setRemark("");
      setSelectedStatus("");
      setRevisedDueDate("");
      // Refresh
      const d = await dispatch(fetchDelegationById(id)).unwrap();
      setDelegation(d);
    } catch { toast.error("Update failed"); }
    finally { setIsUpdating(false); }
  };

  const statusMap = {
    'NEED CLARITY': { bg: 'bg-amber-100', text: 'text-amber-600', dot: 'bg-amber-500' },
    'APPROVAL WAITING': { bg: 'bg-blue-100', text: 'text-blue-600', dot: 'bg-blue-500' },
    'COMPLETED': { bg: 'bg-emerald-100', text: 'text-emerald-600', dot: 'bg-emerald-500' },
    'NEED REVISION': { bg: 'bg-orange-100', text: 'text-orange-600', dot: 'bg-orange-500' },
    'HOLD': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-500' },
  };
  const ss = statusMap[delegation.status] || statusMap.HOLD;

  return (
    <MainLayout title={`Intel #${delegation.id}`}>
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 lg:p-12 animate-in fade-in duration-700">
        
        {/* Header Section */}
        <div className="max-w-7xl mx-auto space-y-8">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="space-y-4 max-w-3xl">
                 <Link to="/tasks/my-tasks" className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#137fec] bg-white px-4 py-2 rounded-full w-fit shadow-sm border border-white hover:shadow-md transition-all">
                    <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
                    Back to Command Hub
                 </Link>
                 <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-400 tracking-tighter shadow-sm bg-white px-3 py-1 rounded-lg">#{delegation.id}</span>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border border-white ${ss.bg} ${ss.text}`}>
                       {delegation.status}
                    </span>
                 </div>
                 <h1 className="text-4xl md:text-6xl font-black text-[#1A2D2B] tracking-tighter leading-[0.9] italic animate-in slide-in-from-left-4 duration-500 uppercase">{delegation.delegation_name}</h1>
              </div>
              <div className="flex items-center gap-2">
                 <div className="flex -space-x-3">
                    {[delegation.delegator_name, delegation.doer_name].map((name, i) => (
                      <div key={i} className={`size-12 rounded-2xl border-4 border-slate-50 flex items-center justify-center font-black text-white text-lg shadow-lg ${i === 0 ? 'bg-[#137fec] rotate-3' : 'bg-purple-500 -rotate-3 hover:rotate-0 transition-all'}`}>
                        {name?.charAt(0)}
                      </div>
                    ))}
                 </div>
                 <div className="ml-2">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">STAKEHOLDERS</p>
                   <p className="text-xs font-bold text-[#1A2D2B] uppercase">{delegation.delegator_name?.split(' ')[0]} & {delegation.doer_name?.split(' ')[0]}</p>
                 </div>
              </div>
           </div>

           {/* Content Grid */}
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              
              {/* Left Column: Brief & Instructions */}
              <div className="lg:col-span-3 space-y-8">
                 
                 {/* Execution Canvas */}
                 <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-2xl shadow-[#137fec]/10 border border-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                       <span className="material-symbols-outlined text-[120px] -rotate-12">description</span>
                    </div>
                    <div className="relative z-10 space-y-8">
                       <div className="flex items-center gap-4 text-[#137fec]">
                          <span className="material-symbols-outlined text-4xl">subject</span>
                          <h2 className="text-2xl font-black uppercase tracking-tighter italic">Mission Brief</h2>
                       </div>
                       <p className="text-xl md:text-2xl font-medium text-slate-500 leading-relaxed max-w-5xl">
                          {delegation.description || "No expanded intelligence provided for this mission."}
                       </p>

                       {/* Meta Bar */}
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-slate-50">
                          <div>
                             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">PRIORITY</p>
                             <div className="flex items-center gap-2">
                                <div className={`size-2.5 rounded-full ${delegation.priority === 'high' ? 'bg-red-500 animate-pulse' : delegation.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                <span className="text-xs font-black uppercase text-[#1A2D2B]">{delegation.priority}</span>
                             </div>
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">DEPARTMENT</p>
                             <span className="text-xs font-black uppercase text-[#1A2D2B]">{delegation.department}</span>
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">DEADLINE</p>
                             <span className="text-xs font-black uppercase text-red-500">{new Date(delegation.due_date).toLocaleDateString('en-GB')}</span>
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">EVIDENCE</p>
                             <span className="text-xs font-black uppercase text-[#137fec]">{delegation.evidence_required ? 'STRICT REQ.' : 'NOT REQ.'}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Assets Section */}
                 {(delegation.voice_note_url || (delegation.reference_docs?.length > 0)) && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {delegation.voice_note_url && (
                        <div className="bg-white rounded-[32px] p-6 shadow-xl border border-white space-y-4">
                           <div className="flex items-center gap-3 text-[#137fec]">
                              <span className="material-symbols-outlined">mic</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">Voice Protocol</span>
                           </div>
                           <audio controls src={delegation.voice_note_url} className="w-full h-10 filter hue-rotate-[150deg] brightness-125" />
                        </div>
                      )}
                      <div className="bg-white rounded-[32px] p-6 shadow-xl border border-white space-y-4">
                         <div className="flex items-center gap-3 text-[#137fec]">
                            <span className="material-symbols-outlined">description</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Document Cache</span>
                         </div>
                         <div className="flex flex-wrap gap-2">
                            {delegation.reference_docs?.map((doc, i) => (
                              <a key={i} href={doc} target="_blank" className="size-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#137fec] hover:bg-[#137fec] hover:text-white transition-all shadow-sm">
                                <span className="material-symbols-outlined text-lg">file_open</span>
                              </a>
                            ))}
                         </div>
                      </div>
                   </div>
                 )}

                 {/* Update Control Center */}
                 <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-2xl shadow-[#137fec]/5 border border-white space-y-8">
                    <div className="flex items-center gap-4 text-[#137fec]">
                       <span className="material-symbols-outlined text-4xl">terminal</span>
                       <h2 className="text-2xl font-black uppercase tracking-tighter italic">Status Response</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Transition State</label>
                          <div className="flex flex-wrap gap-2">
                             {['NEED CLARITY', 'APPROVAL WAITING', 'NEED REVISION', 'HOLD', 'COMPLETED'].map(st => {
                               if (st === 'COMPLETED' && !isAdmin) return null;
                               return (
                                <button key={st} onClick={() => setSelectedStatus(st)}
                                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedStatus === st ? 'bg-[#137fec] text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                >{st}</button>
                               )
                             })}
                          </div>
                       </div>
                       { (selectedStatus === 'NEED REVISION' || selectedStatus === 'HOLD') && (
                        <div className="space-y-4 animate-in slide-in-from-top-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Adjusted Deadline</label>
                            <input type="datetime-local" value={revisedDueDate} onChange={e => setRevisedDueDate(e.target.value)} 
                                className="w-full bg-slate-50 border-none rounded-[24px] p-4 text-xs font-black outline-none focus:ring-4 focus:ring-[#137fec]/10" />
                        </div>
                       )}
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Intel Log / Remark</label>
                       <textarea placeholder="Enter discussion or status context..." value={remark} onChange={e => setRemark(e.target.value)}
                         className="w-full bg-slate-50 border-none rounded-[32px] p-8 text-lg font-bold text-slate-600 outline-none focus:ring-8 focus:ring-[#137fec]/5 min-h-[160px] resize-none h-40" />
                    </div>

                    <div className="flex justify-end gap-3">
                       <button onClick={handleUpdate} disabled={isUpdating} 
                         className="bg-[#137fec] hover:bg-[#106bc7] text-white px-12 py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] transition-all shadow-2xl shadow-[#137fec]/30 active:scale-95 flex items-center gap-3">
                          {isUpdating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-lg">rocket_launch</span>}
                          Submit Intel
                       </button>
                    </div>
                 </div>
              </div>

              {/* Right Column: Activity Stream */}
              <div className="space-y-8">
                 <div className="bg-white rounded-[40px] p-8 shadow-xl border border-white sticky top-24">
                    <div className="flex items-center gap-3 text-[#137fec] mb-8">
                       <span className="material-symbols-outlined">forum</span>
                       <h3 className="text-xl font-black uppercase tracking-tighter italic">Comms Log</h3>
                    </div>

                    <div className="space-y-6 max-h-[1000px] overflow-y-auto pr-4 custom-scrollbar">
                       {/* Remarks Section */}
                       <div className="space-y-6">
                          {delegation.remarks_detail?.slice().reverse().map((rem, i) => (
                            <div key={i} className="flex gap-4 group">
                               <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-[#137fec] group-hover:text-white transition-all shrink-0">
                                  {rem.username?.charAt(0)}
                               </div>
                               <div className="flex-1 space-y-1">
                                  <div className="flex justify-between items-center">
                                     <span className="text-[9px] font-black text-[#1A2D2B] uppercase">{rem.username}</span>
                                     <span className="text-[8px] font-bold text-slate-300 uppercase">{new Date(rem.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-[12px] font-bold text-slate-500 leading-tight">{rem.remark}</p>
                               </div>
                            </div>
                          ))}
                          {(!delegation.remarks_detail || delegation.remarks_detail.length === 0) && (
                            <div className="text-center py-12">
                               <span className="material-symbols-outlined text-slate-100 text-6xl">chat_bubble</span>
                               <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest mt-2">Zero Comms Registered</p>
                            </div>
                          )}
                       </div>

                       <div className="h-px bg-slate-50" />

                       {/* History Section */}
                       <div className="space-y-6 opacity-60">
                          <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Protocol Changes</h4>
                          {delegation.revision_history_detail?.map((rev, i) => (
                            <div key={i} className="flex gap-4 border-l-2 border-slate-100 pl-4">
                               <div className="flex-1 space-y-1">
                                  <p className="text-[9px] font-black text-[#1A2D2B] uppercase">Deadline Revision</p>
                                  <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-bold text-red-300 line-through">{new Date(rev.old_due_date).toLocaleDateString()}</span>
                                     <span className="text-lg font-black text-[#137fec]">→</span>
                                     <span className="text-[10px] font-black text-[#137fec]">{new Date(rev.new_due_date).toLocaleDateString()}</span>
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>

           </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DelegationDetail;
