import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, SplitSquareHorizontal, X, Wand2, Paperclip, Image as ImageIcon } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Field, TextInput, Select, Button, Segmented, Toggle, Badge } from './ui/Field';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import type { Transaction, TransactionType, Split } from '../types';
import { todayISO, formatCurrency } from '../lib/format';
import { uid } from '../lib/id';
import { findMatchingRule } from '../lib/rules';
import {
  attachmentsSupported,
  deleteAttachment,
  getAttachmentUrl,
  saveAttachment,
  validateAttachmentFile,
} from '../lib/attachments';

export function TransactionModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Transaction;
}) {
  const { state, addTransaction, updateTransaction, deleteTransaction } = useFinance();
  const { toast } = useToast();

  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [cleared, setCleared] = useState(true);
  const [splits, setSplits] = useState<Split[]>([]);
  const [splitMode, setSplitMode] = useState(false);

  // Receipt attachment: existingAttachmentId is what's already saved (if
  // editing); newAttachmentFile is a pending replacement not yet written to
  // IndexedDB; removeAttachment marks the existing one for deletion on save.
  const [existingAttachmentId, setExistingAttachmentId] = useState<string | undefined>(undefined);
  const [newAttachmentFile, setNewAttachmentFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setDate(editing.date);
      setAccountId(editing.accountId);
      setToAccountId(editing.toAccountId ?? '');
      setCategoryId(editing.categoryId ?? '');
      setAmount(String(editing.amount));
      setPayee(editing.payee);
      setNotes(editing.notes ?? '');
      setTags(editing.tags ?? []);
      setCleared(editing.cleared ?? true);
      setSplits(editing.splits ?? []);
      setSplitMode(Boolean(editing.splits?.length));
      setExistingAttachmentId(editing.attachmentId);
    } else {
      setType('expense');
      setDate(todayISO());
      setAccountId(state.accounts[0]?.id ?? '');
      setToAccountId(state.accounts[1]?.id ?? '');
      setCategoryId('');
      setAmount('');
      setPayee('');
      setNotes('');
      setTags([]);
      setCleared(true);
      setSplits([]);
      setSplitMode(false);
      setExistingAttachmentId(undefined);
    }
    setNewAttachmentFile(null);
    setRemoveAttachment(false);
    setTagDraft('');
  }, [open, editing, state.accounts]);

  // Loads a preview for whichever attachment is currently "active": a freshly
  // chosen file takes priority, then the saved one, unless it was removed.
  useEffect(() => {
    if (newAttachmentFile) {
      const url = URL.createObjectURL(newAttachmentFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (existingAttachmentId && !removeAttachment) {
      let cancelled = false;
      let cleanup: (() => void) | undefined;
      getAttachmentUrl(existingAttachmentId).then((result) => {
        if (cancelled || !result) return;
        setPreviewUrl(result.url);
        cleanup = result.revoke;
      });
      return () => {
        cancelled = true;
        cleanup?.();
      };
    }
    setPreviewUrl(null);
  }, [newAttachmentFile, existingAttachmentId, removeAttachment]);

  const categories = state.categories.filter(
    (c) => c.type === (type === 'income' ? 'income' : 'expense') && !c.archived
  );

  const knownPayees = useMemo(
    () => Array.from(new Set(state.transactions.map((t) => t.payee))).sort(),
    [state.transactions]
  );

  // Surface the rule that will auto-categorize this payee, so it isn't a surprise.
  const matchedRule = useMemo(
    () => (payee.trim() && !categoryId && !splitMode ? findMatchingRule(state.rules, payee) : undefined),
    [payee, categoryId, splitMode, state.rules]
  );
  const matchedRuleCategory = state.categories.find((c) => c.id === matchedRule?.categoryId);

  const total = parseFloat(amount) || 0;
  const splitSum = splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const unassigned = Math.round((total - splitSum) * 100) / 100;

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, '');
    if (!t) return;
    setTags((list) => Array.from(new Set([...list, t])));
    setTagDraft('');
  };

  const addSplitRow = () => {
    setSplits((rows) => [
      ...rows,
      { id: uid(), categoryId: categories[0]?.id ?? '', amount: Math.max(0, unassigned) },
    ]);
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast('Enter an amount greater than zero', { tone: 'error' });
    if (!accountId) return toast('Pick an account', { tone: 'error' });
    if (!payee.trim()) return toast('Enter a payee or description', { tone: 'error' });
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      return toast('Choose two different accounts for a transfer', { tone: 'error' });
    }
    const activeSplits = splitMode ? splits.filter((s) => s.categoryId && Number(s.amount) > 0) : [];
    if (splitMode && activeSplits.length > 0 && Math.abs(unassigned) > 0.01) {
      return toast(
        `Splits must add up to ${formatCurrency(amt, state.settings.currency)} — ${formatCurrency(
          Math.abs(unassigned),
          state.settings.currency
        )} ${unassigned > 0 ? 'unassigned' : 'over'}`,
        { tone: 'error' }
      );
    }

    // Resolve the receipt attachment: write a newly chosen file to
    // IndexedDB, delete one the user removed, or leave the existing one
    // alone. Done last so a validation error above never orphans a save.
    let attachmentId = existingAttachmentId;
    if (newAttachmentFile) {
      attachmentId = uid();
      try {
        await saveAttachment(attachmentId, newAttachmentFile);
      } catch {
        toast("Couldn't save the receipt image — saving the transaction without it", { tone: 'warning' });
        attachmentId = existingAttachmentId;
      }
      if (existingAttachmentId && existingAttachmentId !== attachmentId) {
        deleteAttachment(existingAttachmentId).catch(() => {});
      }
    } else if (removeAttachment && existingAttachmentId) {
      deleteAttachment(existingAttachmentId).catch(() => {});
      attachmentId = undefined;
    }

    const payload: Omit<Transaction, 'id'> = {
      date,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' || activeSplits.length ? undefined : categoryId || undefined,
      type,
      amount: amt,
      payee: payee.trim(),
      notes: notes.trim() || undefined,
      tags: tags.length ? tags : undefined,
      cleared,
      splits: activeSplits.length ? activeSplits.map((s) => ({ ...s, amount: Number(s.amount) })) : undefined,
      attachmentId,
    };

    if (editing) {
      updateTransaction(editing.id, payload);
      toast('Transaction updated');
    } else {
      addTransaction(payload);
      toast('Transaction added');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit transaction' : 'New transaction'}
      width={540}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                deleteTransaction(editing.id);
                if (editing.attachmentId) deleteAttachment(editing.attachmentId).catch(() => {});
                toast('Transaction deleted');
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
          <Button onClick={submit}>{editing ? 'Save changes' : 'Add transaction'}</Button>
        </>
      }
    >
      <div className="mb-4">
        <Segmented
          value={type}
          onChange={(v) => {
            setType(v);
            setCategoryId('');
            if (v === 'transfer') {
              setSplitMode(false);
              setSplits([]);
            }
          }}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
            { value: 'transfer', label: 'Transfer' },
          ]}
          className="w-full [&>button]:flex-1"
        />
      </div>

      <Field label="Payee / description">
        <TextInput
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          placeholder="e.g. Whole Foods"
          list="payee-suggestions"
          autoFocus
        />
        <datalist id="payee-suggestions">
          {knownPayees.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>

      {matchedRule && matchedRuleCategory && (
        <div
          className="flex items-center gap-2 text-xs -mt-1 mb-3.5 px-2.5 py-2 rounded-lg"
          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
        >
          <Wand2 size={13} />
          A rule will file this under {matchedRuleCategory.icon} {matchedRuleCategory.name}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <TextInput
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {/* Account/category names run longer than amounts or dates, so this
          row stacks on narrow screens instead of squeezing two selects
          into ~145px each, where longer account names were truncating. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={type === 'transfer' ? 'From account' : 'Account'}>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>

        {type === 'transfer' ? (
          <Field label="To account">
            <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              {state.accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </Field>
        ) : (
          <Field label="Category">
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={splitMode}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {type !== 'transfer' && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              <SplitSquareHorizontal size={14} /> Split across categories
            </span>
            <Toggle
              checked={splitMode}
              onChange={(v) => {
                setSplitMode(v);
                if (v && splits.length === 0) {
                  setSplits([{ id: uid(), categoryId: categories[0]?.id ?? '', amount: total }]);
                }
                if (v) setCategoryId('');
              }}
            />
          </div>

          {splitMode && (
            <div
              className="rounded-lg p-3 space-y-2"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              {splits.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Select
                    value={s.categoryId}
                    onChange={(e) =>
                      setSplits((rows) =>
                        rows.map((r) => (r.id === s.id ? { ...r, categoryId: e.target.value } : r))
                      )
                    }
                    className="flex-1"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </Select>
                  <TextInput
                    type="number"
                    step="0.01"
                    value={String(s.amount)}
                    onChange={(e) =>
                      setSplits((rows) =>
                        rows.map((r) =>
                          r.id === s.id ? { ...r, amount: parseFloat(e.target.value) || 0 } : r
                        )
                      )
                    }
                    className="!w-28"
                  />
                  <button
                    onClick={() => setSplits((rows) => rows.filter((r) => r.id !== s.id))}
                    className="p-1.5 rounded-md transition hover:opacity-70"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={addSplitRow}>
                  <Plus size={14} /> Add split
                </Button>
                <span
                  className="text-xs font-medium tnum"
                  style={{
                    color:
                      Math.abs(unassigned) < 0.01
                        ? 'var(--color-positive)'
                        : 'var(--color-warning)',
                  }}
                >
                  {Math.abs(unassigned) < 0.01
                    ? 'Fully allocated'
                    : `${formatCurrency(Math.abs(unassigned), state.settings.currency)} ${
                        unassigned > 0 ? 'left' : 'over'
                      }`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <Field label="Tags">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
            >
              #{t}
              <button onClick={() => setTags((list) => list.filter((x) => x !== t))}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <TextInput
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Type a tag and press Enter"
        />
      </Field>

      <Field label="Notes">
        <TextInput
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note"
        />
      </Field>

      {attachmentsSupported() && (
        <Field label="Receipt">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const error = validateAttachmentFile(file);
              if (error) return toast(error, { tone: 'error' });
              setNewAttachmentFile(file);
              setRemoveAttachment(false);
            }}
          />
          {previewUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={previewUrl}
                alt="Receipt"
                className="w-16 h-16 rounded-lg object-cover shrink-0"
                style={{ border: '1px solid var(--color-border)' }}
              />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip size={13} /> Replace
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewAttachmentFile(null);
                    setRemoveAttachment(true);
                  }}
                >
                  <X size={13} /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon size={14} /> Attach a photo
            </Button>
          )}
        </Field>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Cleared {!cleared && <Badge tone="warning">pending</Badge>}
        </span>
        <Toggle checked={cleared} onChange={setCleared} />
      </div>
    </Modal>
  );
}
