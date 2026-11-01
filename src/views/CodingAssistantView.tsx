import React, { useState } from 'react';
import { Play, Lightbulb } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const CodingAssistantView: React.FC = () => {
  const [code, setCode] = useState<string>(
`function lengthOfLongestSubstring(s: string): number {
    let maxLength = 0;
    let start = 0;
    const charMap = new Map<string, number>();

    for (let end = 0; end < s.length; end++) {
        const char = s[end];
        if (charMap.has(char) && charMap.get(char)! >= start) {
            start = charMap.get(char)! + 1;
        }
        charMap.set(char, end);
        maxLength = Math.max(maxLength, end - start + 1);
    }

    return maxLength;
}`
  );

  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    setConsoleOutput(null);
    setTimeout(() => {
      setIsRunning(false);
      setConsoleOutput(
`[Local Sandbox - Mock Run]
Test Case 1: "abcabcbb" -> Output: 3 (Expected: 3) [PASSED]
Test Case 2: "bbbbb"    -> Output: 1 (Expected: 1) [PASSED]
Test Case 3: "pwwkew"   -> Output: 3 (Expected: 3) [PASSED]

All 3 local test cases passed! Time complexity: O(n), Space complexity: O(min(m, n)).`
      );
    }, 600);
  };

  const handleHint = () => {
    setHint(
      'Hint (Simulated AI): Notice that you only need to slide the "start" pointer forward when you see a duplicate character within the current window. Using a Hash Map maps each character to its most recent index.'
    );
  };

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Live Coding Assistant</h2>
            <Badge variant="mock">Phase 1 Simulated Runner</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Algorithmic problem practice with local runtime analysis and hint generation
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Problem Statement Column */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-800 bg-surface-900/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">Problem #3</span>
              <Badge variant="warning" size="sm">Medium</Badge>
            </div>
            <h3 className="text-base font-bold text-white">Longest Substring Without Repeating Characters</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Given a string <code className="text-brand-300 bg-surface-950 px-1 py-0.5 rounded font-mono">s</code>,
              find the length of the <strong>longest substring</strong> without repeating characters.
            </p>

            <div className="space-y-2 pt-2">
              <div className="p-2.5 rounded-lg bg-surface-950 border border-slate-800 text-xs font-mono">
                <span className="text-slate-400 block">Input: s = "abcabcbb"</span>
                <span className="text-slate-200 block font-semibold mt-0.5">Output: 3</span>
                <span className="text-slate-400 block text-[11px] mt-0.5">Explanation: The answer is "abc", with length 3.</span>
              </div>
            </div>

            {hint && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 animate-fade-in">
                {hint}
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleHint}
                leftIcon={<Lightbulb className="w-3.5 h-3.5 text-amber-400" />}
              >
                Request AI Hint
              </Button>
            </div>
          </Card>
        </div>

        {/* Code Editor & Runner Column */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-slate-800 bg-surface-900/90 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono text-slate-400">solution.ts (TypeScript)</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRun}
                  isLoading={isRunning}
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                >
                  Run Tests
                </Button>
              </div>
            </div>

            {/* Simulated Code Editor */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={12}
              className="w-full bg-surface-950 text-slate-200 font-mono text-xs p-3 rounded-lg border border-slate-800/80 focus:outline-none focus:border-brand-500 selection:bg-brand-500/30 leading-relaxed resize-y"
              spellCheck={false}
            />

            {/* Console Output */}
            {consoleOutput && (
              <div className="mt-3 p-3 rounded-lg bg-surface-950 border border-slate-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap animate-fade-in">
                {consoleOutput}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
