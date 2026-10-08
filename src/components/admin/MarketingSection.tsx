import React, { useState } from 'react';
import { Sparkles, Copy } from 'lucide-react';
import { Team } from '../../types';
import { api } from '../../api';
import { Button, Card, Errors, Field, Notice, SectionHeader, Select, TextArea, useRunner } from './ui';

export const MarketingSection: React.FC<{ teams: Team[] }> = ({ teams }) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [prompt, setPrompt] = useState('');
  const [teamId, setTeamId] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setErrors({ prompt: 'Describe what you want written.' });
      return;
    }
    setErrors({});
    const team = teams.find(t => t.id === teamId);
    const res = await run('gen', () => api.generateMarketing(prompt.trim(), team?.name));
    if (res) setResult(res.text);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setNotice({ kind: 'ok', text: 'Copied to clipboard.' });
    } catch {
      setNotice({ kind: 'err', text: 'Could not copy — select the text manually.' });
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="AI copy drafts" description="Drafts from Gemini for you to review and edit. Nothing is published automatically — check every fact before using it." />
      <Card>
        <form onSubmit={generate} className="space-y-3" noValidate>
          <Field label="What should it write?" required error={errors.prompt}>
            <TextArea rows={4} value={prompt} onChange={e => setPrompt(e.target.value)} error={!!errors.prompt} placeholder="e.g. A short Instagram caption announcing that fixtures are now live on the site" />
          </Field>
          <Field label="Team (optional)">
            <Select value={teamId} onChange={e => setTeamId(e.target.value)}>
              <option value="">League-wide</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="primary" loading={busy === 'gen'} icon={<Sparkles className="w-4 h-4" />} className="w-full sm:w-auto">
            Generate draft
          </Button>
        </form>
      </Card>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {result && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-extrabold text-white">Draft</h3>
            <Button size="sm" onClick={copy} icon={<Copy className="w-4 h-4" />}>
              Copy
            </Button>
          </div>
          <TextArea rows={10} value={result} onChange={e => setResult(e.target.value)} aria-label="Generated draft" />
        </Card>
      )}
    </div>
  );
};
