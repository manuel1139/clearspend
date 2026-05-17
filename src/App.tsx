/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Trash2, 
  Tag as TagIcon, 
  Plus, 
  X, 
  ChevronRight, 
  Loader2, 
  Receipt as ReceiptIcon,
  Search,
  Filter,
  AlertCircle,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { scanReceipt, parseOrderText } from './lib/gemini';
import type { Receipt } from './types';

function normalizeReceiptDate(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const german = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (german) {
    const [, day, month, rawYear] = german;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

export default function App() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Receipt[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [isDragging, setIsDragging] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(1000);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const res = await fetch('/api/receipts');
        const data = await res.json();
        setReceipts(data);
      } catch (err) {
        console.error('Failed to fetch:', err);
      }
    };

    const fetchBudget = async () => {
      try {
        const res = await fetch('/api/settings/budget');
        const data = await res.json();
        setMonthlyBudget(parseFloat(data.budget));
      } catch (err) {
        console.error('Failed to fetch budget:', err);
      }
    };

    fetchReceipts();
    fetchBudget();
  }, []);

  const updateBudget = async (newBudget: number) => {
    try {
      await fetch('/api/settings/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget: newBudget })
      });
      setMonthlyBudget(newBudget);
      setIsEditingBudget(false);
    } catch {
      setError('Fehler beim Aktualisieren des Budgets.');
    }
  };

  const handleManualEntry = () => {
    const manualReceipt: Receipt = {
      id: 'temp-' + Date.now(),
      merchant: 'Neue Ausgabe',
      date: new Date().toISOString().split('T')[0],
      total: 0,
      currency: 'EUR',
      category: 'Sonstiges',
      tags: [],
      items: [],
      createdAt: new Date().toISOString(),
    };
    setSelectedReceipt(manualReceipt);
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) return;
    
    setIsScanning(true);
    setIsPasting(false);
    setError(null);
    
    try {
      const results = await parseOrderText(pastedText);
      const newReceipts: Receipt[] = results.map((result, index) => ({
        id: `temp-${Date.now()}-${index}`,
        merchant: result.merchant,
        date: normalizeReceiptDate(result.date) ?? new Date().toISOString().split('T')[0],
        total: result.total,
        currency: result.currency ?? 'EUR',
        category: result.category,
        tags: [],
        items: result.items ?? [],
        createdAt: new Date().toISOString(),
      }));

      if (newReceipts.length > 0) {
        setReviewQueue(newReceipts);
        setSelectedReceipt(newReceipts[0]);
        setPastedText('');
      } else {
        setError('Keine Bestelldaten im Text erkannt.');
      }
    } catch (err) {
      setError('Fehler beim Verarbeiten des Textes.' + (err instanceof Error ? ` ${err.message}` : ''));
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset value to allow selecting the same file again
    e.target.value = '';
  };

  const processFile = async (file: File) => {
    setIsScanning(true);
    setError(null);
    setSelectedReceipt(null);
    setReviewQueue([]);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const results = await scanReceipt(base64, file.type);
          
          const newReceipts: Receipt[] = results.map((result, index) => ({
            id: `temp-${Date.now()}-${index}`,
            merchant: result.merchant,
            date: normalizeReceiptDate(result.date) ?? new Date().toISOString().split('T')[0],
            total: result.total,
            currency: result.currency ?? 'EUR',
            category: result.category,
            tags: [],
            items: result.items ?? [],
            box_2d: result.box_2d,
            createdAt: new Date().toISOString(),
            imageUrl: reader.result as string
          }));

          if (newReceipts.length > 0) {
            setReviewQueue(newReceipts);
            setSelectedReceipt(newReceipts[0]);
          } else {
            setError('Keine Belege im Bild erkannt.');
          }
        } catch (err) {
          console.error('Scan error:', err);
          setError('Analyse des Belegs fehlgeschlagen. Das Bild ist möglicherweise unscharf.');
        } finally {
          setIsScanning(false);
        }
      };
      reader.onerror = () => {
        setError('Datei konnte nicht gelesen werden.');
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
      setIsScanning(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    } else {
      setError('Bitte ziehen Sie eine gültige Bilddatei hierher.');
    }
  };

  const saveReceipt = async (receipt: Receipt) => {
    setIsUploading(true);
    try {
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt })
      });
      const saved = await res.json();
      
      setReceipts(prev => {
        const index = prev.findIndex(r => r.id === saved.id);
        if (index !== -1) {
          const newList = [...prev];
          newList[index] = saved;
          return newList;
        }
        return [saved, ...prev];
      });
      
      // Handle queue
      setReviewQueue(prev => {
        const remaining = prev.filter(r => r.id !== receipt.id);
        if (remaining.length > 0) {
          setSelectedReceipt(remaining[0]);
        } else {
          setSelectedReceipt(null);
        }
        return remaining;
      });
    } catch {
      setError('Fehler beim Speichern des Belegs.');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteReceipt = async (id: string) => {
    try {
      await fetch(`/api/receipts/${id}`, { method: 'DELETE' });
      setReceipts(prev => prev.filter(r => r.id !== id));
      if (selectedReceipt?.id === id) setSelectedReceipt(null);
    } catch {
      setError('Löschen fehlgeschlagen.');
    }
  };

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = r.merchant.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filterCategory === 'Alle' || r.category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const categories = ['Alle', 'Essen', 'Verkehr', 'Einkaufen', 'Unterhaltung', 'Gesundheit', 'Nebenkosten', 'Lionas', 'Malias', 'Sonstiges'];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-bottom border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-[#1A1A1A] p-2 rounded-xl">
            <ReceiptIcon className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ClearSpend</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPasting(true)}
            className="hidden sm:flex bg-gray-100 text-gray-700 px-4 py-2 rounded-full font-medium items-center gap-2 hover:bg-gray-200 transition-all font-mono text-sm"
          >
            <ClipboardList size={16} />
            <span>Bestellung einfügen</span>
          </button>
          <button 
            onClick={handleManualEntry}
            className="hidden sm:flex bg-gray-100 text-gray-700 px-4 py-2 rounded-full font-medium items-center gap-2 hover:bg-gray-200 transition-all font-mono text-sm"
          >
            <Plus size={16} />
            <span>Manuelle Eingabe</span>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#1A1A1A] text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-black/10"
            id="scan-button"
          >
            <Camera size={18} />
            <span className="hidden sm:inline">Neuer Scan</span>
            <span className="sm:hidden">Scan</span>
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="image/*" 
          className="hidden" 
        />
      </header>

      {/* Budget Widget (Floating Bottom Right) */}
      <BudgetWidget 
        receipts={receipts} 
        budget={monthlyBudget} 
        onUpdateBudget={updateBudget}
        isEditing={isEditingBudget}
        setIsEditing={setIsEditingBudget}
      />

      <main 
        className={`max-w-7xl mx-auto px-6 py-8 transition-all duration-300 ${isDragging ? 'bg-black/5 ring-4 ring-black/10 ring-inset rounded-[3rem]' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Error Alert */}
        <AnimatePresence>
          {isPasting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-2xl rounded-4xl shadow-2xl p-8"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">Bestellung einfügen</h3>
                  <button onClick={() => setIsPasting(false)}><X /></button>
                </div>
                <p className="text-gray-500 text-sm mb-4">Kopieren Sie den Text Ihrer Amazon-Bestellbestätigung oder -seite und fügen Sie ihn hier ein.</p>
                <textarea 
                  autoFocus
                  className="w-full h-64 bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-black mb-6"
                  placeholder="Hier Text einfügen..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
                <button 
                  onClick={handlePasteSubmit}
                  className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-900 transition-all"
                >
                  Text analysieren
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-3"
            >
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto">
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Dashboard & Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-50 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Händler oder Tags suchen..."
                  className="w-full bg-gray-50 border-none rounded-2xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-black translate-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  id="search-input"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      filterCategory === cat 
                        ? 'bg-[#1A1A1A] text-white shadow-lg shadow-gray-200' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Receipts List */}
            <div className="space-y-4">
              {filteredReceipts.length === 0 && !isScanning ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                  <div className="bg-gray-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="text-gray-300" size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Keine Belege gefunden</h3>
                  <p className="text-gray-500 text-sm max-w-xs mx-auto mt-1">
                    Laden Sie Ihren ersten Beleg über die Schaltfläche "Neuer Scan" hoch, um Ihre Ausgaben zu verfolgen.
                  </p>
                </div>
              ) : (
                filteredReceipts.map(receipt => (
                  <motion.div
                    layout
                    key={receipt.id}
                    onClick={() => setSelectedReceipt(receipt)}
                    className={`bg-white p-5 rounded-3xl border transition-all cursor-pointer hover:shadow-xl hover:shadow-gray-200/50 flex items-center group ${
                      selectedReceipt?.id === receipt.id ? 'border-black ring-1 ring-black shadow-lg shadow-gray-200' : 'border-gray-100'
                    }`}
                    id={`receipt-card-${receipt.id}`}
                  >
                    <div className="bg-gray-50 w-12 h-12 rounded-2xl flex items-center justify-center mr-4 group-hover:bg-black group-hover:text-white transition-colors">
                      <ReceiptIcon size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{receipt.merchant}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500 font-medium">{new Date(receipt.date).toLocaleDateString()}</span>
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">{receipt.category}</span>
                      </div>
                    </div>
                    <div className="text-right mr-4">
                      <div className="font-bold text-lg">{receipt.currency} {receipt.total.toFixed(2)}</div>
                      <div className="flex gap-1 mt-1 justify-end">
                        {receipt.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-bold">#{tag}</span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-300 group-hover:text-black transition-colors" />
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Preview / Edit */}
          <div className="lg:col-span-1">
            <div className="sticky top-28">
              {isScanning ? (
                <div className="bg-white p-8 rounded-4xl border border-gray-100 shadow-xl flex flex-col items-center justify-center min-h-100">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="mb-6"
                  >
                    <Loader2 size={48} className="text-black" />
                  </motion.div>
                  <h3 className="text-xl font-bold mb-2">Beleg wird analysiert</h3>
                  <p className="text-gray-500 text-center text-sm">
                    Unsere KI extrahiert Daten und kategorisiert Ihren Scan...
                  </p>
                </div>
              ) : selectedReceipt ? (
                <div className="space-y-4">
                  {reviewQueue.length > 1 && (
                    <div className="bg-black text-white px-6 py-3 rounded-full flex items-center justify-between text-xs font-bold shadow-xl">
                      <span>MEHRERE BELEGE ERKANNT</span>
                      <span>{reviewQueue.findIndex(r => r.id === selectedReceipt.id) + 1} von {reviewQueue.length}</span>
                    </div>
                  )}
                  <ReceiptCard 
                    key={selectedReceipt.id}
                    receipt={selectedReceipt} 
                    onSave={saveReceipt}
                    onDelete={() => {
                      if (selectedReceipt.id.startsWith('temp-')) {
                        const remaining = reviewQueue.filter(r => r.id !== selectedReceipt.id);
                        setReviewQueue(remaining);
                        setSelectedReceipt(remaining.length > 0 ? remaining[0] : null);
                      } else {
                        deleteReceipt(selectedReceipt.id);
                      }
                    }}
                    isUploading={isUploading}
                    onClose={() => {
                      setSelectedReceipt(null);
                      setReviewQueue([]);
                    }}
                  />
                </div>
              ) : (
                <div className="bg-gray-200/50 rounded-[2rem] border-2 border-dashed border-gray-300 flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
                  <div className="bg-white p-4 rounded-3xl shadow-sm mb-4">
                    <TagIcon className="text-gray-300" size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700">Scan-Zusammenfassung</h3>
                  <p className="text-gray-500 text-sm mt-2">
                    Wählen Sie einen Beleg aus oder scannen Sie einen neuen, um Details und Tags zu sehen.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function BudgetWidget({ 
  receipts, 
  budget, 
  onUpdateBudget,
  isEditing,
  setIsEditing
}: { 
  receipts: Receipt[], 
  budget: number, 
  onUpdateBudget: (val: number) => void,
  isEditing: boolean,
  setIsEditing: (val: boolean) => void
}) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlySpent = receipts
    .filter(r => {
      const d = new Date(r.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, r) => sum + r.total, 0);

  const remaining = budget - monthlySpent;
  const percentage = Math.min(100, (monthlySpent / budget) * 100);

  return (
    <motion.div 
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed bottom-8 right-8 z-50 pointer-events-none"
    >
      <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-6 w-72 pointer-events-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monatsbudget</h4>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="text-gray-400 hover:text-black transition-colors"
          >
            <Filter size={14} />
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-4 mb-4">
            <div className="flex gap-2">
              <input 
                autoFocus
                type="number"
                defaultValue={budget}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onUpdateBudget(parseFloat((e.target as HTMLInputElement).value));
                }}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 font-mono font-bold focus:ring-2 focus:ring-black"
              />
              <button 
                onClick={(e) => {
                  const input = (e.currentTarget.previousSibling as HTMLInputElement);
                  onUpdateBudget(parseFloat(input.value));
                }}
                className="bg-black text-white p-2 rounded-xl"
              >
                <Plus size={18} />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 italic text-center">Drücken Sie Enter zum Speichern</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1 mb-2">
              <span className={`text-4xl font-black ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{Math.abs(remaining).toLocaleString()}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase">{remaining >= 0 ? 'Übrig' : 'Überz.'}</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-gray-400">AUSGEGEBEN: €{monthlySpent.toLocaleString()}</span>
                <span className="text-gray-400">ZIEL: €{budget.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  className={`h-full rounded-full ${percentage > 90 ? 'bg-red-500' : 'bg-black'}`}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function ReceiptCard({ 
  receipt: initialReceipt, 
  onSave, 
  onDelete, 
  isUploading,
  onClose
}: { 
  receipt: Receipt; 
  onSave: (r: Receipt) => void; 
  onDelete: () => void;
  isUploading: boolean;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState(initialReceipt);
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    if (tagInput.trim() && !receipt.tags.includes(tagInput.trim())) {
      setReceipt({ ...receipt, tags: [...receipt.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setReceipt({ ...receipt, tags: receipt.tags.filter(t => t !== tag) });
  };

  const isNew = receipt.id.startsWith('temp-');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-4xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[calc(100vh-140px)]"
    >
      <div className="p-6 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-xl font-bold">{isNew ? 'Scan überprüfen' : 'Belegdetails'}</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">Händler</label>
            <input 
              type="text" 
              value={receipt.merchant} 
              onChange={e => setReceipt({...receipt, merchant: e.target.value})}
              className="w-full text-lg font-bold border-none p-0 focus:ring-0 bg-transparent"
              placeholder="Händlername"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">Belegdatum</label>
            <input
              type="date"
              value={receipt.date}
              onChange={e => setReceipt({ ...receipt, date: e.target.value })}
              className="w-full bg-gray-50 border-none rounded-xl text-sm font-semibold py-2 px-3 focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">Gesamtbetrag</label>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-500">{receipt.currency}</span>
                <input 
                  type="number" 
                  value={receipt.total} 
                  onChange={e => setReceipt({...receipt, total: parseFloat(e.target.value) || 0})}
                  className="w-full text-xl font-bold border-none p-0 focus:ring-0 bg-transparent"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">Kategorie</label>
              <select 
                value={receipt.category} 
                onChange={e => setReceipt({...receipt, category: e.target.value})}
                className="w-full bg-gray-50 border-none rounded-xl text-sm font-semibold py-2 px-3 focus:ring-2 focus:ring-black"
                id="category-select"
              >
                <option value="Essen">Essen</option>
                <option value="Verkehr">Verkehr</option>
                <option value="Einkaufen">Einkaufen</option>
                <option value="Unterhaltung">Unterhaltung</option>
                <option value="Gesundheit">Gesundheit</option>
                <option value="Nebenkosten">Nebenkosten</option>
                <option value="Lionas">Lionas</option>
                <option value="Malias">Malias</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-gray-50 p-4 rounded-2xl">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 block">Eigene Tags</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {receipt.tags.map(tag => (
              <span key={tag} className="bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                {tag}
                <button onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X size={12} />
                </button>
              </span>
            ))}
            {receipt.tags.length === 0 && <span className="text-xs text-gray-400 italic">Noch keine Tags</span>}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Tag hinzufügen..." 
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-black shadow-sm"
              id="tag-input"
            />
            <button 
              onClick={addTag}
              className="bg-black text-white p-2 rounded-xl hover:bg-gray-800 transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Item Breakdown */}
        {receipt.items && receipt.items.length > 0 && (
          <div className="bg-gray-50 p-5 rounded-3xl">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-4 block">Einzelne Positionen</label>
            <div className="space-y-4">
              {receipt.items.map((item, idx) => (
                <div key={idx} className="flex gap-4 items-start text-sm group">
                  {item.imageUrl && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white border border-gray-100">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex-1 pr-4">
                    <div className="text-gray-900 font-bold group-hover:text-black transition-colors">{item.name}</div>
                    <div className="flex gap-2 items-center">
                      {item.quantity && (
                        <div className="text-[10px] text-gray-400 font-medium">Menge: {item.quantity}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-gray-900">
                    {receipt.currency} {item.price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Gesamt</span>
              <span className="text-xl font-black text-black">{receipt.currency} {receipt.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Image Preview (if available) */}
        {receipt.imageUrl && (
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Beleg-Ausschnitt</label>
            <div className={`relative overflow-hidden rounded-3xl border border-gray-100 bg-gray-50 ${receipt.box_2d ? 'aspect-4/3' : 'aspect-video'}`}>
              {receipt.box_2d ? (
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${receipt.imageUrl})`,
                    backgroundSize: `${100000 / (receipt.box_2d[3] - receipt.box_2d[1])}% ${100000 / (receipt.box_2d[2] - receipt.box_2d[0])}%`,
                    backgroundPosition: `${(receipt.box_2d[1] / (1000 - (receipt.box_2d[3] - receipt.box_2d[1]))) * 100}% ${(receipt.box_2d[0] / (1000 - (receipt.box_2d[2] - receipt.box_2d[0]))) * 100}%`,
                  }}
                />
              ) : (
                <img src={receipt.imageUrl} alt="Receipt Preview" className="w-full h-full object-contain grayscale opacity-60" />
              )}
            </div>
            {receipt.box_2d && (
              <p className="text-[10px] text-gray-400 text-center italic">KI-erkannter Ausschnitt des Belegs</p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 bg-gray-50 flex gap-3 mt-auto">
        {!isNew && (
          <button 
            onClick={onDelete}
            className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors"
            id="delete-button"
          >
            <Trash2 size={20} />
          </button>
        )}
        <button 
          onClick={() => onSave(receipt)}
          disabled={isUploading}
          className="flex-1 bg-black text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-900 transition-all disabled:opacity-50"
          id="confirm-button"
        >
          {isUploading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            isNew ? <span>Ausgabe speichern</span> : <span>Eintrag aktualisieren</span>
          )}
        </button>
      </div>
    </motion.div>
  );
}
