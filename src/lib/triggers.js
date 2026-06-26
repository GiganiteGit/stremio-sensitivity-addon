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

// One-line summary for a catalog item's description.
function summaryLine(triggers, limit = 4) {
  if (!triggers || !triggers.length) return 'No community-flagged sensitivity triggers.';
  const top = triggers.slice(0, limit).map((t) => `${t.name} (${t.yes}/${t.no})`).join(', ');
  const more = triggers.length > limit ? `, +${triggers.length - limit} more` : '';
  return `⚠ DTDD: ${top}${more}`;
}

// Full grouped description for the meta detail page.
function groupedDescription(triggers, dtddUrl) {
  if (!triggers || !triggers.length) {
    return `No sensitivity triggers flagged by the DoesTheDogDie community.\n\nSource: ${dtddUrl}`;
  }
  const byCat = {};
  for (const t of triggers) (byCat[t.category] ||= []).push(t);
  const lines = Object.entries(byCat)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat, ts]) => `${cat}: ${ts.map((t) => `${t.name} (${t.yes}✓/${t.no}✗)`).join('; ')}`);
  return (
    '⚠ Sensitivity triggers flagged by the DoesTheDogDie community ' +
    '(✓ yes / ✗ no votes):\n\n' +
    `${lines.join('\n')}\n\nSource: ${dtddUrl}`
  );
}

module.exports = { isPresent, presentTriggers, summaryLine, groupedDescription };
