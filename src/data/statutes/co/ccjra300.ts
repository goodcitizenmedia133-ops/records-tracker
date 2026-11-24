import type { StateStatutePack } from './cora200';

export const CCJRA_300_PACK: StateStatutePack = {
  stateCode: 'CO',
  stateName: 'Colorado',
  actName: 'Colorado Criminal Justice Records Act (CCJRA)',
  statutoryRange: 'C.R.S. ? 24-72-301 through ? 24-72-309 (Title 24, Article 72, Part 3)',
  sourceNote:
    'Based on Colorado Revised Statutes Title 24, Article 72, Part 3 (Colorado Criminal Justice Records Act). State-scoped lazy module for law enforcement, sheriff, prosecutor, and criminal justice agency records.',
  sections: [
    {
      citation: 'C.R.S. ? 24-72-301',
      title: 'Legislative declaration',
      summary:
        'Declares public policy that criminal justice records be maintained and made available for inspection in accordance with Part 3, balancing public access with privacy, safety, and investigative integrity.',
      keyRules: [
        'Governs records made, maintained, or kept by criminal justice agencies in Colorado.',
        'Separates mandatory openness for records of official action from custodian discretion for other criminal justice records.',
      ],
      appGuidance:
        'Use Part 3 (CCJRA) instead of CORA (Part 2) whenever the custodian is a police department, sheriff, district attorney, or criminal justice agency.',
    },
    {
      citation: 'C.R.S. ? 24-72-302',
      title: 'Definitions',
      summary:
        'Defines "arrest and criminal records information", "basic identification information", "criminal justice agency", "criminal justice records", "custodian", "official custodian", "disposition", and "records of official action".',
      keyRules: [
        'Records of official action (? 24-72-302(7)) specifically include arrest, indictment, charging by information, disposition, pretrial or post-trial release from custody, judicial mental/physical condition determinations, and probation, parole, or correctional/rehabilitative program decisions.',
        'Basic identification information (? 24-72-302(2)) includes name, place and date of birth, last-known address, social security number (subject to redaction), occupation and address of employment, physical description, photograph, date and time of arrest, and arresting agency.',
      ],
      appGuidance:
        'Classify requested items as "records of official action" (mandatory disclosure) versus general investigative/incident records (discretionary balancing).',
    },
    {
      citation: 'C.R.S. ? 24-72-303',
      title: 'Records of official actions required - open to inspection',
      summary:
        'Mandates that criminal justice agencies keep records of official actions and keep them open for inspection by any person at reasonable times, except as otherwise provided by Part 3 or other law.',
      keyRules: [
        'Records of official action are open to inspection by any person at reasonable times unless sealed or barred by specific statute or court order.',
        'Custodians may make rules and regulations reasonably necessary for the protection of records and prevention of unnecessary interference with regular duties.',
      ],
      appGuidance:
        'Anchor blotter, arrest log, booking, charging, and disposition requests directly on ? 24-72-303 mandatory inspection.',
    },
    {
      citation: 'C.R.S. ? 24-72-304',
      title: 'Inspection of criminal justice records',
      summary:
        'Provides that, except for records of official actions which must be open under ? 24-72-303, all other criminal justice records may be open to inspection at the discretion of the official custodian, subject to statutory exceptions.',
      keyRules: [
        'Applies custodian discretion to non-official-action records such as active or closed investigative files, CAD/dispatch narratives, and intelligence records.',
        'Prohibits release of records where inspection is contrary to state statute, federal law, or court rule/order.',
      ],
      appGuidance:
        'When requesting incident reports, CAD logs, or body-worn camera/investigative files, address public-interest balancing proactively.',
    },
    {
      citation: 'C.R.S. ? 24-72-305',
      title: 'Allowance or denial of inspection - grounds - procedure - appeal',
      summary:
        'Establishes grounds for denying inspection (contrary to state/federal law, court order, or contrary to the public interest), requires a written statement of grounds within 72 hours upon request, and provides district court show-cause review.',
      keyRules: [
        'Public-interest denial applies to investigatory files, intelligence information, or security procedures when disclosure would be contrary to the public interest.',
        'Written denial statement (? 24-72-305(6)): Upon applicant request, the custodian must provide a written statement of grounds within 72 hours citing the specific law/regulation or general nature of the public interest.',
        'District court remedy (? 24-72-305(7)): Applicant may apply for an order to show cause; arbitrary or capricious denial of a record of official action authorizes court-ordered penalties up to $25 per day plus court costs and reasonable attorney fees.',
      ],
      appGuidance:
        'Always demand a written statement of statutory grounds within 72 hours under ? 24-72-305(6) whenever an agency withholds or redacts CCJRA records.',
    },
    {
      citation: 'C.R.S. ? 24-72-305.3',
      title: 'Private access to criminal history records of volunteers and employees',
      summary:
        'Governs authorized access to criminal history records for designated screening and public-safety purposes.',
      keyRules: [
        'Applies to specialized background screening access rather than general public inspection requests.',
      ],
      appGuidance: 'Distinguish general public/journalist CCJRA requests from background-check screening provisions.',
    },
    {
      citation: 'C.R.S. ? 24-72-305.4',
      title: 'Governmental access to criminal history records of applicants in regulated professions or occupations',
      summary:
        'Addresses licensing and regulatory agency access to criminal history records.',
      keyRules: [
        'Applies to state licensing boards and regulated occupation vetting.',
      ],
      appGuidance: 'Reference only when distinguishing licensing board access from public inspection rights.',
    },
    {
      citation: 'C.R.S. ? 24-72-305.5',
      title: 'Access to records - denial by custodian - use of records to obtain information for solicitation',
      summary:
        'Prohibits using criminal justice records obtained under Part 3 for the direct solicitation of business for pecuniary gain and authorizes custodians to require a signed affirmation.',
      keyRules: [
        'Records shall not be used for direct solicitation of business for pecuniary gain.',
        'Custodians may deny access unless the applicant signs a statement affirming the records will not be used for direct solicitation for pecuniary gain.',
        'News reporting, civic accountability, and public-interest journalism are non-solicitation uses.',
      ],
      appGuidance:
        'Include an explicit ? 24-72-305.5 non-pecuniary-solicitation affirmation in CCJRA request templates to prevent administrative delay.',
    },
    {
      citation: 'C.R.S. ? 24-72-306',
      title: 'Copies, printouts, or photographs of criminal justice records - fees authorized',
      summary:
        'Authorizes custodians to furnish copies, printouts, or photographs and charge reasonable fees not to exceed actual costs.',
      keyRules: [
        'Fees must be reasonable and may not exceed actual costs of search, retrieval, redaction, copying, or delivery.',
        'Allows inspection without charge where copying is not requested, subject to reasonable supervision rules.',
      ],
      appGuidance:
        'Request itemized actual-cost breakdowns whenever an agency quotes search, redaction, or copy fees under ? 24-72-306.',
    },
    {
      citation: 'C.R.S. ? 24-72-307',
      title: 'Challenge to accuracy and completeness - appeals',
      summary:
        'Sets procedures for a person in interest to inspect and challenge the accuracy or completeness of criminal justice records.',
      keyRules: [
        'Applies to record subjects seeking correction or notation of disputed criminal justice entries.',
      ],
      appGuidance: 'Separate from third-party public inspection requests under ?? 24-72-303 and 24-72-304.',
    },
    {
      citation: 'C.R.S. ? 24-72-308',
      title: 'Sealing of arrest and criminal records other than convictions',
      summary:
        'Governs court-ordered sealing of eligible non-conviction arrest and criminal records and limits public disclosure once sealed.',
      keyRules: [
        'Once properly sealed by court order, basic identification information may be released only as permitted by statute while sealed records are withheld from general public inspection.',
      ],
      appGuidance:
        'Verify whether an agency cites a court sealing order under ? 24-72-308 or ? 24-72-701 et seq. when denying arrest/case records.',
    },
    {
      citation: 'C.R.S. ? 24-72-309',
      title: 'Violation - penalty',
      summary:
        'Establishes criminal misdemeanor penalties for any person who willfully and knowingly violates the provisions of Part 3.',
      keyRules: [
        'Applies to willful and knowing violations of Part 3 statutory duties or prohibitions (including unlawful disclosure or pecuniary-gain solicitation violations).',
      ],
      appGuidance:
        'Unlike repealed CORA ? 24-72-206, CCJRA ? 24-72-309 remains an active statutory penalty provision alongside civil remedies under ? 24-72-305(7).',
    },
  ],
};
