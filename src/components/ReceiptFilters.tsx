import { Search } from 'lucide-react';

interface ReceiptFiltersProps {
  categories: readonly string[];
  searchQuery: string;
  filterCategory: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
}

export function ReceiptFilters({
  categories,
  searchQuery,
  filterCategory,
  onSearchChange,
  onFilterChange,
}: ReceiptFiltersProps) {
  return (
    <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-50 relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={18}
        />
        <input
          type="text"
          placeholder="Händler oder Tags suchen..."
          className="w-full bg-gray-50 border-none rounded-2xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-black translate-all"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          id="search-input"
        />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onFilterChange(category)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filterCategory === category
                ? 'bg-[#1A1A1A] text-white shadow-lg shadow-gray-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
