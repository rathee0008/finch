import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Wand2, Play, Pencil } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import type { Rule, RuleMatchType } from '../types';
import { Modal } from './ui/Modal';
import { Field, TextInput, Select, Button, Toggle, Badge } from './ui/Field';
import { EmptyState } from './ui/EmptyState';
import { countMatches, ruleMatches } from '../lib/rules';

const MATCH_LABELS: Record<RuleMatchType, string> = {
  contains: 'contains',
  startsWith: 'starts with',
  exact: 'is exactly',
  regex: 'matches regex',
};

function RuleModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Rule;
}) {
  const { state, addRule, updateRule, deleteRule } = useFinance();
  const { toast } = useToast();

  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState<RuleMatchType>('contains');
  const [categoryId, setCategoryId] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    setPattern(editing?.pattern ?? '');
    setMatchType(editing?.matchType ?? 'contains');
    setCategoryId(editing?.categoryId ?? '');
    setRenameTo(editing?.renameTo ?? '');
    setTagsText((editing?.addTags ?? []).join(', '));
    setEnabled(editing?.enabled ?? true);
  }, [open, editing]);

  // Live preview of which existing transactions this rule catches.
  const preview = useMemo(() => {
    if (!pattern.trim()) return [];
    const draft: Rule = { id: 'draft', pattern, matchType, enabled: true };
    return state.transactions.filter((t) => ruleMatches(draft, t.payee)).slice(0, 6);
  }, [pattern, matchType, state.transactions]);

  const submit = () => {
    if (!pattern.trim()) return toast('Enter text to match on', { tone: 'error' });
    if (!categoryId && !renameTo.trim() && !tagsText.trim()) {
      return toast('A rule needs at least one action', { tone: 'error' });
    }
    const payload = {
      pattern: pattern.trim(),
      matchType,
      categoryId: categoryId || undefined,
      renameTo: renameTo.trim() || undefined,
      addTags: tagsText
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean),
      enabled,
    };
    if (editing) {
      updateRule(editing.id, payload);
      toast('Rule updated');
    } else {
      addRule(payload);
      toast('Rule created');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit rule' : 'New rule'}
      subtitle="Rules run automatically on new and imported transactions."
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                deleteRule(editing.id);
                toast('Rule deleted');
                onClose();
              }}
            >
              <Trash2 size={15} /> Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? 'Save changes' : 'Create rule'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-[auto_1fr] gap-3 items-end mb-1">
        <Field label="When payee">
          <Select value={matchType} onChange={(e) => setMatchType(e.target.value as RuleMatchType)}>
            {Object.entries(MATCH_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Text">
          <TextInput
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. Starbucks"
            autoFocus
          />
        </Field>
      </div>

      <div
        className="rounded-lg p-3 mb-4"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
      >
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Then apply
        </div>
        <Field label="Category">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Don't change category</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rename payee to" hint="Optional — tidies up messy bank descriptions">
          <TextInput
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            placeholder="e.g. Starbucks"
          />
        </Field>
        <Field label="Add tags" hint="Comma separated">
          <TextInput
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="coffee, treat"
          />
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--color-text)' }}>
            Rule enabled
          </span>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
      </div>

      {pattern.trim() && (
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Matches {preview.length > 0 ? `(${preview.length}+ shown)` : ''}
          </div>
          {preview.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              No existing transactions match this yet.
            </p>
          ) : (
            <div className="space-y-1">
              {preview.map((t) => (
                <div
                  key={t.id}
                  className="text-xs px-2.5 py-1.5 rounded-md"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
                >
                  {t.payee}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function Rules() {
  const { state, updateRule, applyRulesToExisting } = useFinance();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | undefined>(undefined);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Rules
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Categorize, rename and tag transactions automatically
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const n = applyRulesToExisting();
              toast(
                n > 0 ? `Updated ${n} existing transactions` : 'Every transaction already matches your rules',
                { tone: n > 0 ? 'success' : 'info' }
              );
            }}
          >
            <Play size={15} /> Run on existing
          </Button>
          <Button
            onClick={() => {
              setEditing(undefined);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> New rule
          </Button>
        </div>
      </div>

      {state.rules.length === 0 ? (
        <EmptyState
          icon={Wand2}
          title="No rules yet"
          description="Create a rule so transactions from a payee are filed under the right category the moment they arrive."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Create your first rule
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {state.rules.map((rule) => {
            const cat = state.categories.find((c) => c.id === rule.categoryId);
            const matches = countMatches({ ...rule, enabled: true }, state.transactions);
            return (
              <div key={rule.id} className="card p-4 flex items-center gap-3 flex-wrap">
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: rule.enabled ? 'var(--color-accent-soft)' : 'var(--color-surface-2)',
                    color: rule.enabled ? 'var(--color-accent)' : 'var(--color-text-subtle)',
                  }}
                >
                  <Wand2 size={16} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="text-sm flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--color-text)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Payee</span>
                    <span className="font-medium">{MATCH_LABELS[rule.matchType]}</span>
                    <code
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{ background: 'var(--color-surface-2)' }}
                    >
                      {rule.pattern}
                    </code>
                    <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                    {cat && (
                      <span className="font-medium">
                        {cat.icon} {cat.name}
                      </span>
                    )}
                    {rule.renameTo && <Badge tone="accent">rename → {rule.renameTo}</Badge>}
                    {(rule.addTags ?? []).map((t) => (
                      <Badge key={t} tone="accent">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                    {matches} matching {matches === 1 ? 'transaction' : 'transactions'}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <Toggle
                    checked={rule.enabled}
                    onChange={(v) => updateRule(rule.id, { enabled: v })}
                  />
                  <button
                    onClick={() => {
                      setEditing(rule);
                      setModalOpen(true);
                    }}
                    className="p-2 rounded-lg transition hover:opacity-70"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RuleModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
