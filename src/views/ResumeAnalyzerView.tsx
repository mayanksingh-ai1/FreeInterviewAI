import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const ResumeAnalyzerView: React.FC = () => {
  const [fileName, setFileName] = useState<string | null>('Mayank_Singh_Resume.pdf');
  const [targetRole, setTargetRole] = useState('Senior Full-Stack Engineer');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(true);

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    setShowResults(false);
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowResults(true);
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Local Resume & ATS Analyzer</h2>
            <Badge variant="mock">Phase 1 Mock Analysis</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Parse and evaluate your resume against targeted job descriptions 100% locally on your machine
          </p>
        </div>
      </div>

      {/* Upload & Target Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-800 bg-surface-900/80 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Resume File (PDF / DOCX)</h3>
          <div className="border border-dashed border-slate-700/80 rounded-xl p-6 text-center bg-surface-950/60 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center mb-2">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-300 font-medium">{fileName || 'Choose or drag a resume file'}</p>
            <p className="text-[11px] text-slate-400 mt-1">Processed locally on Intel Core i5. No cloud upload.</p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setFileName(e.target.files[0].name);
              }}
            />
            <label
              htmlFor="file-upload"
              className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-200 border border-slate-700 cursor-pointer transition"
            >
              Browse Local File
            </label>
          </div>
        </Card>

        <Card className="border-slate-800 bg-surface-900/80 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Target Role Profile</h3>
            <label className="block text-xs text-slate-400 mb-1">Target Job Title</label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full bg-surface-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 mb-4"
              placeholder="e.g. Senior Frontend Engineer"
            />
            <p className="text-xs text-slate-400 leading-relaxed">
              The local parser compares keyword density, leadership achievements, and technological relevance
              against top-tier job requirements.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={handleRunAnalysis}
            isLoading={isAnalyzing}
            className="w-full mt-4"
          >
            Analyze Resume Match
          </Button>
        </Card>
      </div>

      {/* Mock Analysis Output */}
      {showResults && (
        <Card className="border-slate-800 bg-surface-900/90 p-6 space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-white">Target Match Assessment</span>
                <Badge variant="mock">Mock Evaluation</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Matched against: {targetRole}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold text-emerald-400">84%</span>
              <span className="text-xs text-slate-400">ATS Match<br/>Readiness</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-surface-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Key Identified Strengths
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Strong emphasis on TypeScript, React Architecture, and State Design</li>
                <li>Clear quantified metrics ("Improved load time by 40%")</li>
                <li>Demonstrated cross-functional collaboration and leadership</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-surface-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                Missing / Suggested Keywords
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['CI/CD Pipelines', 'Docker', 'GraphQL', 'Observability / Datadog', 'Unit Test Coverage (Jest)'].map((kw, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-surface-900 border border-slate-800 text-slate-300">
                    + {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
