import type { Rule, Transaction } from '../types';

export function ruleMatches(rule: Rule, payee: string): boolean {
  if (!rule.enabled || !rule.pattern.trim()) return false;
  const haystack = payee.toLowerCase();
  const needle = rule.pattern.trim().toLowerCase();

  switch (rule.matchType) {
    case 'contains':
      return haystack.includes(needle);
    case 'startsWith':
      return haystack.startsWith(needle);
    case 'exact':
      return haystack === needle;
    case 'regex':
      try {
        return new RegExp(rule.pattern, 'i').test(payee);
      } catch {
        return false; // invalid regex never matches
      }
    default:
      return false;
  }
}

export function findMatchingRule(rules: Rule[], payee: string): Rule | undefined {
  return rules.find((r) => ruleMatches(r, payee));
}

/**
 * Returns the changes the first matching rule would make to a transaction.
 * An explicit category already on the transaction is never overwritten.
 */
export function applyRules(
  rules: Rule[],
  tx: Pick<Transaction, 'payee' | 'categoryId' | 'tags'>
): Partial<Transaction> {
  const rule = findMatchingRule(rules, tx.payee);
  if (!rule) return {};

  const patch: Partial<Transaction> = {};
  if (rule.categoryId && !tx.categoryId) patch.categoryId = rule.categoryId;
  if (rule.renameTo) patch.payee = rule.renameTo;
  if (rule.addTags?.length) {
    const merged = new Set([...(tx.tags ?? []), ...rule.addTags]);
    patch.tags = Array.from(merged);
  }
  return patch;
}

/** How many existing transactions a rule would affect — shown in the rules UI. */
export function countMatches(rule: Rule, transactions: Transaction[]): number {
  return transactions.filter((t) => ruleMatches(rule, t.payee)).length;
}
