import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { PaymentRule, Receipt, ReceiptCategory } from '../types';

interface ReceiptCardProps {
  categories?: ReceiptCategory[];
  paymentRules?: PaymentRule[];
  receipt: Receipt;
  onSave: (receipt: Receipt) => void;
  onDelete: () => void;
  isUploading: boolean;
  onClose: () => void;
}

export function ReceiptCard({
  categories = [],
  paymentRules = [],
  receipt: initialReceipt,
  onSave,
  onDelete,
  isUploading,
  onClose,
}: ReceiptCardProps) {
  const [receipt, setReceipt] = useState(initialReceipt);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    setReceipt(initialReceipt);
    setTagInput('');
  }, [initialReceipt]);

  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (!trimmedTag || receipt.tags.includes(trimmedTag)) return;

    setReceipt({ ...receipt, tags: [...receipt.tags, trimmedTag] });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setReceipt({
      ...receipt,
      tags: receipt.tags.filter((currentTag) => currentTag !== tag),
    });
  };

  const isNew = receipt.id.startsWith('temp-');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-4xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[calc(100vh-140px)]"
    >
      <div className="p-6 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-xl font-bold">
          {isNew ? 'Scan überprüfen' : 'Belegdetails'}
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
              Händler
            </label>
            <input
              type="text"
              value={receipt.merchant}
              onChange={(event) =>
                setReceipt({ ...receipt, merchant: event.target.value })
              }
              className="w-full text-lg font-bold border-none p-0 focus:ring-0 bg-transparent"
              placeholder="Händlername"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
              Belegdatum
            </label>
            <input
              type="date"
              value={receipt.date}
              onChange={(event) =>
                setReceipt({ ...receipt, date: event.target.value })
              }
              className="w-full bg-gray-50 border-none rounded-xl text-sm font-semibold py-2 px-3 focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                Gesamtbetrag
              </label>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-500">{receipt.currency}</span>
                <input
                  type="number"
                  value={receipt.total}
                  onChange={(event) =>
                    setReceipt({
                      ...receipt,
                      total: parseFloat(event.target.value) || 0,
                    })
                  }
                  className="w-full text-xl font-bold border-none p-0 focus:ring-0 bg-transparent"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                Kategorie
              </label>
              <select
                value={receipt.categoryId}
                onChange={(event) => {
                  const nextCategory = categories.find(
                    (category) => category.id === Number(event.target.value),
                  );

                  if (!nextCategory) return;

                  setReceipt({
                    ...receipt,
                    categoryId: nextCategory.id,
                    categoryName: nextCategory.name,
                  });
                }}
                className="w-full bg-gray-50 border-none rounded-xl text-sm font-semibold py-2 px-3 focus:ring-2 focus:ring-black"
                id="category-select"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
              Zahlungsregel
            </label>
            <select
              value={receipt.paymentRuleId}
              onChange={(event) => {
                const nextPaymentRule = paymentRules.find(
                  (rule) => rule.id === Number(event.target.value),
                );

                if (!nextPaymentRule) return;

                setReceipt({
                  ...receipt,
                  paymentRuleId: nextPaymentRule.id,
                  paymentRuleName: nextPaymentRule.name,
                  paymentRuleFrequency: nextPaymentRule.frequency,
                });
              }}
              className="w-full bg-gray-50 border-none rounded-xl text-sm font-semibold py-2 px-3 focus:ring-2 focus:ring-black"
            >
              {paymentRules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-2xl">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 block">
            Eigene Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {receipt.tags.map((tag) => (
              <span
                key={tag}
                className="bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {receipt.tags.length === 0 && (
              <span className="text-xs text-gray-400 italic">Noch keine Tags</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Tag hinzufügen..."
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addTag()}
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

        {receipt.items && receipt.items.length > 0 && (
          <div className="bg-gray-50 p-5 rounded-3xl">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-4 block">
              Einzelne Positionen
            </label>
            <div className="space-y-4">
              {receipt.items.map((item, index) => (
                <div key={index} className="flex gap-4 items-start text-sm group">
                  {item.imageUrl && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white border border-gray-100">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1 pr-4">
                    <div className="text-gray-900 font-bold group-hover:text-black transition-colors">
                      {item.name}
                    </div>
                    <div className="flex gap-2 items-center">
                      {item.quantity && (
                        <div className="text-[10px] text-gray-400 font-medium">
                          Menge: {item.quantity}
                        </div>
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
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Gesamt
              </span>
              <span className="text-xl font-black text-black">
                {receipt.currency} {receipt.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {receipt.imageUrl && (
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              Beleg-Ausschnitt
            </label>
            <div
              className={`relative overflow-hidden rounded-3xl border border-gray-100 bg-gray-50 ${
                receipt.box_2d ? 'aspect-4/3' : 'aspect-video'
              }`}
            >
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
                <img
                  src={receipt.imageUrl}
                  alt="Receipt Preview"
                  className="w-full h-full object-contain grayscale opacity-60"
                />
              )}
            </div>
            {receipt.box_2d && (
              <p className="text-[10px] text-gray-400 text-center italic">
                KI-erkannter Ausschnitt des Belegs
              </p>
            )}
          </div>
        )}
      </div>

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
          ) : isNew ? (
            <span>Ausgabe speichern</span>
          ) : (
            <span>Eintrag aktualisieren</span>
          )}
        </button>
      </div>
    </motion.div>
  );
}
