import React, { useState } from 'react';
import { Search, BookOpen, ExternalLink, Lightbulb } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { QuestionItem } from '../types';
import { MOCK_QUESTIONS } from '../mocks/mockData';

export const QuestionBankView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [inspectQuestion, setInspectQuestion] = useState<QuestionItem | null>(null);

  const categories = ['All', 'Frontend', 'Backend', 'System Design', 'Algorithms', 'Behavioral'];
  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  const filteredQuestions = MOCK_QUESTIONS.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || q.category === selectedCategory;
    const matchesDiff = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
    return matchesSearch && matchesCat && matchesDiff;
  });

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Curated Interview Question Bank</h2>
            <Badge variant="secondary">Phase 1 Offline Dataset</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Categorized database of essential engineering, architecture, and behavioral questions
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search questions by topic, keyword, or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Chips */}
          <div className="flex items-center gap-1 bg-surface-900 p-1 rounded-lg border border-slate-800">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-md transition ${
                  selectedCategory === cat
                    ? 'bg-brand-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Difficulty Dropdown */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="bg-surface-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
          >
            {difficulties.map((d) => (
              <option key={d} value={d}>
                Difficulty: {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Questions Grid */}
      {filteredQuestions.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Matching Questions"
          description="Try broadening your search keywords or switching category filters."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setSelectedCategory('All');
            setSelectedDifficulty('All');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuestions.map((q) => (
            <Card
              key={q.id}
              hoverable
              onClick={() => setInspectQuestion(q)}
              className="flex flex-col justify-between border-slate-800 bg-surface-900/70 p-5 group hover:border-brand-500/50"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-mono text-brand-300">{q.category}</span>
                  <Badge
                    variant={
                      q.difficulty === 'Easy'
                        ? 'success'
                        : q.difficulty === 'Medium'
                        ? 'warning'
                        : 'danger'
                    }
                    size="sm"
                  >
                    {q.difficulty}
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold text-slate-100 group-hover:text-brand-300 transition-colors mb-2 line-clamp-2">
                  {q.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                  {q.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {q.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded bg-surface-950 text-slate-400 border border-slate-800 font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-slate-400 group-hover:text-white flex items-center gap-1 shrink-0 ml-2">
                  View <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Inspect Question Modal */}
      <Modal
        isOpen={!!inspectQuestion}
        onClose={() => setInspectQuestion(null)}
        title={inspectQuestion ? inspectQuestion.title : 'Question Details'}
        footer={
          <Button variant="secondary" size="sm" onClick={() => setInspectQuestion(null)}>
            Close
          </Button>
        }
      >
        {inspectQuestion && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="primary">{inspectQuestion.category}</Badge>
              <Badge variant="warning">{inspectQuestion.difficulty}</Badge>
            </div>

            <div>
              <p className="font-semibold text-slate-200 text-sm mb-1.5">Problem Context:</p>
              <p className="text-slate-300 leading-relaxed text-xs">{inspectQuestion.description}</p>
            </div>

            {inspectQuestion.sampleAnswerHint && (
              <div className="p-3.5 rounded-lg bg-surface-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-brand-300">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  Key Discussion Points & Architecture Hints:
                </div>
                <p className="text-slate-400 leading-relaxed">{inspectQuestion.sampleAnswerHint}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
