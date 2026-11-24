export interface StatuteSectionEntry {
  citation: string;
  title: string;
  summary: string;
  keyRules: string[];
  appGuidance: string;
}

export interface StateStatutePack {
  stateCode: 'CO';
  stateName: 'Colorado';
  actName: string;
  statutoryRange: string;
  sourceNote: string;
  sections: StatuteSectionEntry[];
}

export const CORA_200_PACK: StateStatutePack = {
  stateCode: 'CO',
  stateName: 'Colorado',
  actName: 'Colorado Open Records Act (CORA)',
  statutoryRange: 'C.R.S. ? 24-72-200.1 through ? 24-72-206 (Title 24, Article 72, Part 2)',
  sourceNote:
    'Based on Colorado Revised Statutes Title 24, Article 72, Part 2. Keep as a state-scoped module so other states do not pay bundle weight for Colorado statute text.',
  sections: [
    {
      citation: 'C.R.S. ? 24-72-200.1',
      title: 'Short title',
      summary: 'Names Title 24, Article 72, Part 2 the "Colorado Open Records Act" or "CORA".',
      keyRules: ['Applies to public records inspection, copying, or photographing under Part 2.'],
      appGuidance: 'Primary statutory citation for standard Colorado public records requests.',
    },
    {
      citation: 'C.R.S. ? 24-72-201',
      title: 'Legislative declaration',
      summary:
        'Declares that all public records are open for inspection by any person at reasonable times unless exempted by Part 2 or other specific law.',
      keyRules: [
        'Default presumption favors access unless a specific statutory exemption applies.',
        'Open to any person at reasonable times.',
      ],
      appGuidance: 'Supports baseline openness framing in request notes and denial reviews.',
    },
    {
      citation: 'C.R.S. ? 24-72-202',
      title: 'Definitions',
      summary:
        'Defines public records, writings, correspondence, custodian, official custodian, person, political subdivision, privileged information, and work product.',
      keyRules: [
        'Covers writings made, maintained, or kept by the state or political subdivisions in exercising functions or administering programs.',
        'Distinguishes Part 2 CORA from Part 3 criminal justice records and elected-official work product rules.',
      ],
      appGuidance: 'Helps verify whether a request belongs under CORA (Part 2) or Criminal Justice Records (Part 3).',
    },
    {
      citation: 'C.R.S. ? 24-72-203',
      title: 'Public records open to inspection',
      summary:
        'Governs inspection rights, reasonable custodian rules/hours, and handling of records in active use or storage.',
      keyRules: [
        'Custodians may set reasonable rules to protect records and avoid unnecessary interference with duties.',
        'Records must be produced within statutory timelines and reasonable periods.',
      ],
      appGuidance: 'Pairs with request dates, response tracking, and delay/retrieval audit notes.',
    },
    {
      citation: 'C.R.S. ? 24-72-204',
      title: 'Allowance or denial of inspection - grounds - procedure - appeal',
      summary:
        'Covers mandatory/permissive withholdings or redactions, written statutory explanations upon request, and district court review.',
      keyRules: [
        'Separates records barred by law/privilege from public-interest injury claims.',
        'Allows requesting a written statement of statutory grounds on denial and seeking district court review.',
      ],
      appGuidance: 'Log exact cited exemptions, dates, and denial rationales whenever an agency withholds or redacts.',
    },
    {
      citation: 'C.R.S. ? 24-72-204.5',
      title: 'Adoption of electronic mail policy',
      summary: 'Addresses electronic mail policies for covered public bodies and officials.',
      keyRules: ['Covers email policy obligations where applicable under state law.'],
      appGuidance: 'Useful reference when requesting or auditing agency emails.',
    },
    {
      citation: 'C.R.S. ? 24-72-205',
      title: 'Copy, printout, or photograph - research and retrieval fee',
      summary:
        'Governs copy/print/photo charges and sets rules, free-time thresholds, and limits on research and retrieval fees.',
      keyRules: [
        'Subject to statutory fee rules, free initial time allowances, and hourly caps where applicable.',
      ],
      appGuidance: 'Cross-check whenever an email import or agency reply quotes research, retrieval, or copy fees.',
    },
    {
      citation: 'C.R.S. ? 24-72-205.5',
      title: 'Public inspection of ballots',
      summary: 'Sets rules, stay periods, recount restrictions, and procedures for ballot inspection.',
      keyRules: ['Subject to election stay periods and statutory inspection windows.'],
      appGuidance: 'Flag ballot/election items so special timing rules are visible.',
    },
    {
      citation: 'C.R.S. ? 24-72-206',
      title: 'Violation - penalty',
      summary:
        'Historical penalty provision marked repealed in C.R.S.; remedies/review proceed under ? 24-72-204.',
      keyRules: ['Marked repealed?do not cite as an active criminal penalty provision.'],
      appGuidance: 'Prevents outdated penalty citations in drafts or notes.',
    },
  ],
};
