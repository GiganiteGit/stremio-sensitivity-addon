// Trigger presence + display formatting.
// Phase 0 finding: voteSum is NOT yes-no, so presence = community net-yes (yesSum > noSum).
'use strict';

const isPresent = (s) => Number(s.yesSum ?? 0) > Number(s.noSum ?? 0);

// Normalise the raw topicItemStats into present triggers, strongest first.
function presentTriggers(stats) {
  return (stats || [])
    .filter(isPresent)
    .map((s) => ({
      topicId: s.TopicId,
      name: (typeof s.topic === 'string' ? s.topic : s.topic?.name) ?? s.doesName ?? `Topic ${s.TopicId}`,
      category: (typeof s.TopicCategory === 'string' ? s.TopicCategory : s.TopicCategory?.name) ?? 'Other',
      yes: Number(s.yesSum ?? 0),
      no: Number(s.noSum ?? 0),
    }))
    .sort((a, b) => b.yes - a.yes);
}

// Reorder present triggers so the user's pinned ones come first (plan §3/§8).
// `pins` is a Set of TopicIds; absent/empty -> original order, no pinned split.
function orderByPins(triggers, pins) {
  const list = triggers || [];
  if (!pins || !pins.size) return { pinned: [], rest: list, ordered: list };
  const pinned = [];
  const rest = [];
  for (const t of list) (pins.has(t.topicId) ? pinned : rest).push(t);
  return { pinned, rest, ordered: pinned.concat(rest) };
}

// One-line summary for a catalog item's description.
function summaryLine(triggers, limit = 4) {
  if (!triggers || !triggers.length) return 'No community-flagged sensitivity triggers.';
  const top = triggers.slice(0, limit).map((t) => `${t.name} (${t.yes}/${t.no})`).join(', ');
  const more = triggers.length > limit ? `, +${triggers.length - limit} more` : '';
  return `⚠ DTDD: ${top}${more}`;
}

// Full grouped description for the meta detail page. Pinned triggers (if any)
// are marked with ★ and their categories float to the top.
function groupedDescription(triggers, dtddUrl, pins) {
  if (!triggers || !triggers.length) {
    return `No sensitivity triggers flagged by the DoesTheDogDie community.\n\nSource: ${dtddUrl}`;
  }
  const has = (t) => !!pins && pins.has(t.topicId);
  const mark = (t) => `${has(t) ? '★ ' : ''}${t.name} (${t.yes}✓/${t.no}✗)`;
  const byCat = {};
  for (const t of triggers) (byCat[t.category] ||= []).push(t);
  const pinnedInCat = (ts) => ts.filter(has).length;
  const lines = Object.entries(byCat)
    // pinned categories first, then by how many triggers they carry
    .sort((a, b) => pinnedInCat(b[1]) - pinnedInCat(a[1]) || b[1].length - a[1].length)
    .map(([cat, ts]) => `${cat}: ${ts.map(mark).join('; ')}`);
  const pinnedNote = pins && pins.size ? ' (★ = a trigger you pinned)' : '';
  return (
    '⚠ Sensitivity triggers flagged by the DoesTheDogDie community ' +
    `(✓ yes / ✗ no votes)${pinnedNote}:\n\n` +
    `${lines.join('\n')}\n\nSource: ${dtddUrl}`
  );
}

module.exports = { isPresent, presentTriggers, orderByPins, summaryLine, groupedDescription };
