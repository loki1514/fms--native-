/**
 * Deterministic Ticket Classification Engine (Mobile Port)
 *
 * Rules:
 * 1. Convert input text to lowercase
 * 2. Perform keyword matching using dictionary only
 * 3. Longer keyword wins within same skill group (specificity)
 * 4. Resolve across skill groups using precedence: vendor > technical > plumbing > soft_services
 * 5. Location words are ignored for classification
 * 6. If no match: skill_group = technical, issue_code = null, confidence = low
 */

import dictionary from './issueDictionary.json';

export type SkillGroup = 'technical' | 'plumbing' | 'vendor' | 'soft_services';
export type Confidence = 'high' | 'low';

export interface ClassificationResult {
  issue_code: string | null;
  skill_group: SkillGroup;
  confidence: Confidence;
}

export interface EnhancedClassificationResult extends ClassificationResult {
  scores: Record<SkillGroup, number>;
  candidates: Array<{ skill_group: SkillGroup; score: number; issue_code: string | null }>;
  margin: number;
}

interface Match {
  issue_code: string;
  skill_group: SkillGroup;
  keyword: string;
  keyword_length: number;
}

export function classifyTicketEnhanced(text: string): EnhancedClassificationResult {
  const lowerText = text.toLowerCase();
  const matches: Match[] = [];

  const skillGroups: SkillGroup[] = ['vendor', 'technical', 'plumbing', 'soft_services'];

  for (const skillGroup of skillGroups) {
    const issues = dictionary[skillGroup as keyof typeof dictionary];

    if (!issues || typeof issues !== 'object') continue;

    for (const [issueCode, keywords] of Object.entries(issues)) {
      if (!Array.isArray(keywords)) continue;

      for (const keyword of keywords as string[]) {
        if (lowerText.includes(keyword)) {
          matches.push({
            issue_code: issueCode,
            skill_group: skillGroup,
            keyword: keyword,
            keyword_length: keyword.length,
          });
        }
      }
    }
  }

  const scores: Record<SkillGroup, number> = {
    technical: 0,
    plumbing: 0,
    vendor: 0,
    soft_services: 0,
  };

  for (const sg of skillGroups) {
    scores[sg] = matches.filter(m => m.skill_group === sg).length;
  }

  const candidates = skillGroups
    .map(sg => {
      const groupMatches = matches.filter(m => m.skill_group === sg);
      let bestIssueCode: string | null = null;

      if (groupMatches.length > 0) {
        const counts: Record<string, number> = {};
        groupMatches.forEach(m => {
          counts[m.issue_code] = (counts[m.issue_code] || 0) + 1;
        });

        let maxCount = 0;
        for (const [code, count] of Object.entries(counts)) {
          if (count > maxCount) {
            maxCount = count;
            bestIssueCode = code;
          } else if (count === maxCount && bestIssueCode) {
            const currentMaxLen = Math.max(
              ...groupMatches.filter(m => m.issue_code === code).map(m => m.keyword_length),
            );
            const bestMaxLen = Math.max(
              ...groupMatches.filter(m => m.issue_code === bestIssueCode).map(m => m.keyword_length),
            );
            if (currentMaxLen > bestMaxLen) {
              bestIssueCode = code;
            }
          }
        }
      }

      return {
        skill_group: sg,
        score: scores[sg],
        issue_code: bestIssueCode,
      };
    })
    .sort((a, b) => b.score - a.score);

  const topScore = candidates[0]?.score || 0;
  const secondScore = candidates[1]?.score || 0;
  const margin = topScore - secondScore;

  if (matches.length === 0) {
    return {
      issue_code: null,
      skill_group: (dictionary.defaults.fallback_skill_group as SkillGroup) ?? 'technical',
      confidence: (dictionary.defaults.confidence_on_fallback as Confidence) ?? 'low',
      scores,
      candidates,
      margin: 0,
    };
  }

  const precedence = dictionary.precedence_order as SkillGroup[];

  for (const skillGroup of precedence) {
    const groupMatches = matches.filter(m => m.skill_group === skillGroup);

    if (groupMatches.length > 0) {
      const counts: Record<string, number> = {};
      groupMatches.forEach(m => {
        counts[m.issue_code] = (counts[m.issue_code] || 0) + 1;
      });

      let bestIssueCode = groupMatches[0].issue_code;
      let maxCount = 0;

      for (const [code, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          bestIssueCode = code;
        } else if (count === maxCount) {
          const currentMaxLen = Math.max(
            ...groupMatches.filter(m => m.issue_code === code).map(m => m.keyword_length),
          );
          const bestMaxLen = Math.max(
            ...groupMatches.filter(m => m.issue_code === bestIssueCode).map(m => m.keyword_length),
          );
          if (currentMaxLen > bestMaxLen) {
            bestIssueCode = code;
          }
        }
      }

      return {
        issue_code: bestIssueCode,
        skill_group: skillGroup,
        confidence: 'high',
        scores,
        candidates,
        margin,
      };
    }
  }

  return {
    issue_code: null,
    skill_group: 'technical',
    confidence: 'low',
    scores,
    candidates,
    margin: 0,
  };
}

export function classifyTicket(text: string): ClassificationResult {
  const enhanced = classifyTicketEnhanced(text);
  return {
    issue_code: enhanced.issue_code,
    skill_group: enhanced.skill_group,
    confidence: enhanced.confidence,
  };
}

export function getSkillGroupDisplayName(skillGroup: SkillGroup): string {
  const names: Record<SkillGroup, string> = {
    technical: 'Technical',
    plumbing: 'Plumbing',
    vendor: 'Vendor',
    soft_services: 'Soft Services',
  };
  return names[skillGroup];
}

export function getSkillGroupIcon(skillGroup: SkillGroup): string {
  const icons: Record<SkillGroup, string> = {
    technical: 'construct',
    plumbing: 'water',
    vendor: 'business',
    soft_services: 'sparkles',
  };
  return icons[skillGroup];
}

export function getSkillGroupColor(skillGroup: SkillGroup): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<SkillGroup, { bg: string; text: string; border: string }> = {
    technical: { bg: 'rgba(59,130,246,0.1)', text: '#3B82F6', border: 'rgba(59,130,246,0.2)' },
    plumbing: { bg: 'rgba(34,211,238,0.1)', text: '#22D3EE', border: 'rgba(34,211,238,0.2)' },
    vendor: { bg: 'rgba(245,158,11,0.1)', text: '#F59E0B', border: 'rgba(245,158,11,0.2)' },
    soft_services: { bg: 'rgba(168,85,247,0.1)', text: '#A855F7', border: 'rgba(168,85,247,0.2)' },
  };
  return colors[skillGroup];
}

export function getIssueCodeDisplayName(code: string | null): string {
  if (!code) return 'Unclassified';
  return code
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
