import type { StateStatutePack } from '../co/cora200';

export const FOIA_552_PACK: StateStatutePack = {
  stateCode: 'CO',
  stateName: 'Colorado',
  actName: 'Freedom of Information Act (FOIA)',
  statutoryRange: '5 U.S.C. ? 552 (Federal Executive Branch Agencies)',
  sourceNote:
    'Based on 5 U.S.C. ? 552 (including FOIA Improvement Act of 2016 provisions). Applies to federal executive branch agencies rather than state or municipal agencies.',
  sections: [
    {
      citation: '5 U.S.C. ? 552(a)(1)?(3)',
      title: 'Public availability and agency record requests',
      summary:
        'Requires federal agencies to publish core information, maintain reading-room records electronically, and make reasonably described agency records promptly available upon request.',
      keyRules: [
        'Applies to federal executive branch agencies (such as BLM, USFS, FBI, EPA, and federal departments).',
        'Requests must reasonably describe the sought records and comply with published agency FOIA regulations.',
      ],
      appGuidance:
        'Identify the specific federal agency or component and reasonably describe records so searches do not stall on ambiguity.',
    },
    {
      citation: '5 U.S.C. ? 552(a)(4)(A)',
      title: 'Schedule of fees and fee waivers',
      summary:
        'Governs search, review, and duplication fees across requester categories and mandates fee waivers or reductions when disclosure is in the public interest and not primarily in the requester commercial interest.',
      keyRules: [
        'Public-interest fee waiver applies when disclosure is likely to contribute significantly to public understanding of government operations or activities and is not primarily commercial.',
        'Certain statutory fee limits apply if an agency misses statutory processing deadlines without qualifying exceptions.',
      ],
      appGuidance:
        'Include a public-interest fee waiver rationale and request advance cost notification before fees accrue.',
    },
    {
      citation: '5 U.S.C. ? 552(a)(6)(A)?(B)',
      title: 'Initial 20-working-day determination, extensions, and 90-day appeal window',
      summary:
        'Sets a 20-working-day initial determination period, allows extensions for unusual circumstances, and gives requesters at least 90 days to file an administrative appeal.',
      keyRules: [
        'Initial determination window is 20 working days (excluding weekends and legal public holidays) from receipt, subject to narrow statutory tolling.',
        'Unusual circumstances allow extension notice; if extending beyond 10 additional working days, the agency must offer scope modification or an alternative timeframe and OGIS notice.',
        'Requesters have at least 90 days after an adverse determination to appeal, and agencies generally have 20 working days to decide appeals.',
      ],
      appGuidance:
        'Track the 20-working-day clock, log any unusual-circumstances or tolling notice, and calendar the 90-day appeal deadline.',
    },
    {
      citation: '5 U.S.C. ? 552(a)(6)(E)',
      title: 'Expedited processing',
      summary:
        'Requires agencies to decide within 10 calendar days whether to grant expedited processing for compelling need such as imminent threat to life/safety or urgency to inform the public by a news/information disseminator.',
      keyRules: [
        'Agency must notify the requester of its expedited-processing decision within 10 calendar days.',
        'Compelling-need standards require specific facts rather than conclusory assertions.',
      ],
      appGuidance:
        'Request expedited processing only when concrete urgency or safety/public-information criteria are documented.',
    },
    {
      citation: '5 U.S.C. ? 552(a)(8)(A)',
      title: 'Foreseeable harm requirement and reasonable segregation',
      summary:
        'Prohibits withholding under a ? 552(b) exemption unless the agency reasonably foresees specific harm to a protected interest (or disclosure is prohibited by law), and requires segregating nonexempt material.',
      keyRules: [
        'Agencies must articulate foreseeable harm rather than relying on boilerplate or speculative fears.',
        'Reasonably segregable nonexempt portions must be released and redaction locations/exemptions indicated where feasible.',
      ],
      appGuidance:
        'Challenge blanket or boilerplate redactions that fail to show foreseeable harm or segregate releasable portions.',
    },
    {
      citation: '5 U.S.C. ? 552(b)(1)?(9)',
      title: 'Statutory exemptions (b)(1) through (b)(9)',
      summary:
        'Enumerates the nine federal exemptions: (b)(1) classified national defense/foreign policy, (b)(2) internal personnel rules/practices, (b)(3) other federal statutes, (b)(4) confidential commercial/trade secrets, (b)(5) inter-/intra-agency privileges, (b)(6) personal privacy files, (b)(7) law enforcement records, (b)(8) financial institution supervision, and (b)(9) geological well data.',
      keyRules: [
        'Exemption (b)(7) requires a law enforcement purpose plus one of six enumerated harms (A)?(F).',
        'Exemption (b)(5) deliberative process privilege is subject to statutory limits including the 25-year rule for older records.',
      ],
      appGuidance:
        'Verify that each cited (b) exemption matches the record type and satisfies foreseeable-harm and segregation rules.',
    },
    {
      citation: '5 U.S.C. ? 552(a)(4)(B) & (h)(2)',
      title: 'Judicial review and OGIS dispute resolution',
      summary:
        'Provides federal district court jurisdiction to enjoin improper withholding and establishes Office of Government Information Services (OGIS) mediation and compliance review.',
      keyRules: [
        'Administrative exhaustion generally precedes federal court review unless constructive exhaustion applies under statutory rules.',
        'OGIS offers non-compulsory mediation/ombudsman services alongside agency FOIA public liaisons.',
      ],
      appGuidance:
        'Preserve all request dates, agency notices, and appeal filings to support OGIS mediation or federal court review.',
    },
  ],
};
