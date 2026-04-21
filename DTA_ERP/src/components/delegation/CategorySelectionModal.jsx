import React, { useState } from "react";

const NewCategoryModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#137fec");

  const colors = [
    "#E91E63", "#BA68C8", "#9575CD", "#7986CB", "#5C6BC0", "#2196F3", "#03A9F4", "#00BCD4", "#009688", "#4CAF50",
    "#2E7D32", "#689F38", "#FBC02D", "#FFA000", "#F57C00", "#E64A19", "#455A64", "#263238"
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[400px] rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 flex items-center justify-between border-b border-slate-50">
          <h3 className="text-[14px] font-black text-[#1e3a8a] uppercase tracking-widest">New Category</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="space-y-3">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#137fec] uppercase tracking-[0.2em] px-2 bg-blue-50 rounded-md">Identifier</span>
                <div className="flex-1 h-px bg-blue-50"></div>
             </div>
             <div className="relative">
                <input 
                  autoFocus
                  className="w-full bg-blue-50/30 border-2 border-blue-50 rounded-2xl py-4 px-6 text-[15px] font-bold text-slate-600 placeholder:text-slate-300 outline-none focus:border-blue-200/50 transition-all shadow-sm"
                  placeholder="EX: MARKETING STRATEGY"
                  value={name}
                  onChange={(e) => setName(e.target.value.substring(0, 50))}
                />
                <span className="absolute right-4 bottom-[-20px] text-[10px] font-bold text-slate-300 uppercase letter-spacing-widest">{name.length} / 50</span>
             </div>
          </div>

          <div className="space-y-4">
             <div className="text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pick Category Tone</span>
             </div>
             <div className="grid grid-cols-9 gap-3 px-2">
                {colors.map(c => (
                  <button 
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`size-7 rounded-full transition-all hover:scale-110 active:scale-90 ${selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-200 scale-110 shadow-lg' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
             </div>
          </div>
        </div>

        <div className="p-8 pt-0">
           <button 
             onClick={() => onCreate(name, selectedColor)}
             className="w-full py-4 bg-[#137fec] hover:bg-[#0D6AD1] text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all shadow-xl shadow-[#137fec]/20 active:scale-95 flex items-center justify-center gap-2"
           >
              Create Category
           </button>
        </div>
      </div>
    </div>
  );
};

const CategorySelectionModal = ({ isOpen, onClose, onSelect, categories = [] }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);

  const filteredCategories = ["Category", "Operations", "Sales", "Marketing", "Finance", ...categories].filter(c => 
    c.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white w-full max-w-[430px] rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
          <div className="p-7 pb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-black text-[#1e3a8a] uppercase tracking-widest pl-2">Select Category</h3>
            <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors pr-1">
              <span className="material-symbols-outlined text-2xl font-light">close</span>
            </button>
          </div>

          <div className="px-8 pb-4 space-y-8">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 text-2xl font-light">search</span>
              <input 
                autoFocus
                className="w-full bg-white border-2 border-slate-100 rounded-[28px] py-4.5 pl-14 pr-6 text-[16px] font-bold text-slate-500 placeholder:text-slate-300 outline-none focus:border-[#137fec]/30 transition-all shadow-sm"
                placeholder="Find category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto px-1 space-y-1 custom-scrollbar">
               {filteredCategories.map(cat => (
                 <button 
                  key={cat}
                  onClick={() => onSelect(cat)}
                  className="w-full flex items-center justify-between p-4 px-6 rounded-2xl hover:bg-slate-50/50 transition-colors group"
                 >
                   <span className="text-[15px] font-extrabold text-slate-700 tracking-tight">{cat}</span>
                   <div className="size-6 rounded-full border-2 border-slate-100 flex items-center justify-center group-hover:border-[#137fec]/30 transition-all">
                      <span className={`material-symbols-outlined text-[18px] transition-colors ${cat === 'Category' ? 'text-[#137fec]' : 'text-slate-100 group-hover:text-slate-200'}`}>check_circle</span>
                   </div>
                 </button>
               ))}
            </div>
          </div>

          <div className="p-6 pt-2 flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 text-[13px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => setIsNewOpen(true)}
              className="flex-1 py-4.5 px-4 bg-white border border-blue-50 rounded-2xl text-[13px] font-black text-[#137fec] uppercase tracking-widest hover:bg-blue-50/50 transition-all shadow-sm shadow-blue-100/20 flex items-center gap-2 justify-center"
            >
              <span className="material-symbols-outlined text-xl font-bold">add</span>
              Add More
            </button>
            <button 
              onClick={onClose}
              className="flex-1 py-4.5 px-4 bg-[#137fec] hover:bg-[#0D6AD1] text-white rounded-2xl text-[13px] font-black uppercase tracking-widest transition-all shadow-xl shadow-[#137fec]/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              Apply Changes
            </button>
          </div>
        </div>
      </div>

      <NewCategoryModal 
        isOpen={isNewOpen} 
        onClose={() => setIsNewOpen(false)}
        onCreate={(name, color) => {
          onSelect(name);
          setIsNewOpen(false);
          onClose(); // Optional: close selection too? Image implies it.
        }}
      />
    </>
  );
};

export default CategorySelectionModal;
