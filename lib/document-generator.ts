import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { DDQResult } from './types';
import { IMResult } from './types';

/**
 * Generate Word document for DDQ
 */
export async function generateDDQDocument(ddqResult: DDQResult): Promise<Buffer> {
  const sections: Paragraph[] = [
    new Paragraph({
      text: 'ESG Due Diligence Questionnaire',
      heading: 'Heading1',
    }),
    new Paragraph({
      text: 'The Fund defines thresholds for the ESG DD questionnaire. Areas where an investee does not meet the Fund\'s threshold require an Action Plan item. Levels below the threshold are coloured yellow, while levels above the threshold are coloured green.',
    }),
  ];

  // Risk Management Capacity
  sections.push(
    new Paragraph({
      text: 'Risk Management Capacity Questionnaire',
      heading: 'Heading2',
    })
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Area', bold: true }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Definition', bold: true }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Materiality', bold: true }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Level', bold: true }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Comments', bold: true }),
      ],
    })
  );

  ddqResult.riskManagement.forEach((item) => {
    sections.push(
      new Paragraph({ text: item.area }),
      new Paragraph({ text: item.definition }),
      new Paragraph({ text: item.materiality }),
      new Paragraph({ text: item.level }),
      new Paragraph({ text: item.comments }),
      new Paragraph({ text: '' })
    );
  });

  // Environment
  sections.push(
    new Paragraph({
      text: 'Environment Questionnaire',
      heading: 'Heading2',
    })
  );

  ddqResult.environment.forEach((item) => {
    sections.push(
      new Paragraph({ text: item.area }),
      new Paragraph({ text: item.definition }),
      new Paragraph({ text: item.materiality }),
      new Paragraph({ text: item.level }),
      new Paragraph({ text: item.comments }),
      new Paragraph({ text: '' })
    );
  });

  // Social
  sections.push(
    new Paragraph({
      text: 'Social Questionnaire',
      heading: 'Heading2',
    })
  );

  ddqResult.social.forEach((item) => {
    sections.push(
      new Paragraph({ text: item.area }),
      new Paragraph({ text: item.definition }),
      new Paragraph({ text: item.materiality }),
      new Paragraph({ text: item.level }),
      new Paragraph({ text: item.comments }),
      new Paragraph({ text: '' })
    );
  });

  // Governance
  sections.push(
    new Paragraph({
      text: 'Governance Questionnaire',
      heading: 'Heading2',
    })
  );

  ddqResult.governance.forEach((item) => {
    sections.push(
      new Paragraph({ text: item.area }),
      new Paragraph({ text: item.definition }),
      new Paragraph({ text: item.materiality }),
      new Paragraph({ text: item.level }),
      new Paragraph({ text: item.comments }),
      new Paragraph({ text: '' })
    );
  });

  // Track Record
  sections.push(
    new Paragraph({
      text: 'Track Record Questionnaire',
      heading: 'Heading2',
    })
  );

  if (ddqResult.trackRecord.regulatoryBreaches) {
    sections.push(
      new Paragraph({ text: 'Regulatory and legislative breaches:' }),
      new Paragraph({ text: ddqResult.trackRecord.regulatoryBreaches })
    );
  }
  if (ddqResult.trackRecord.supplyChainIssues) {
    sections.push(
      new Paragraph({ text: 'Supply chain issues:' }),
      new Paragraph({ text: ddqResult.trackRecord.supplyChainIssues })
    );
  }
  if (ddqResult.trackRecord.transparencyDisclosure) {
    sections.push(
      new Paragraph({ text: 'Transparency & disclosure:' }),
      new Paragraph({ text: ddqResult.trackRecord.transparencyDisclosure })
    );
  }

  const doc = new Document({
    sections: [
      {
        children: sections,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * Generate Word document for Investment Memo
 */
export async function generateIMDocument(imResult: IMResult): Promise<Buffer> {
  const sections: Paragraph[] = [
    new Paragraph({
      text: 'ESG DD Template for Investment Memos',
      heading: 'Heading1',
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Company Name: ', bold: true }),
        new TextRun({ text: imResult.companyName }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Product/ Activity/ Solution: ', bold: true }),
        new TextRun({ text: imResult.productActivitySolution }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'Findings from the ESG Due Diligence',
      heading: 'Heading2',
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Risk Category (Category C/B+/B): ', bold: true }),
        new TextRun({ text: imResult.riskCategory }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Accessibility of grievance redress mechanism (include website link): ', bold: true }),
        new TextRun({ text: imResult.grievanceRedressMechanism }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Sector & sub-sector: ', bold: true }),
        new TextRun({ text: `${imResult.sector} - ${imResult.subSector}` }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Countries of operation: ', bold: true }),
        new TextRun({ text: imResult.countriesOfOperation }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'No. of Employees: ', bold: true }),
        new TextRun({ text: imResult.numberOfEmployees }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Current risks and opportunities', bold: true }),
      ],
    }),
    new Paragraph({ text: 'Current Risks' }),
    ...imResult.currentRisks.map((risk) => new Paragraph({ text: `* ${risk}` })),
    new Paragraph({ text: '' }),
    new Paragraph({ text: 'Current Opportunities' }),
    ...imResult.currentOpportunities.map((opp) => new Paragraph({ text: `* ${opp}` })),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Long-term risks and opportunities', bold: true }),
      ],
    }),
    new Paragraph({ text: 'Long term risks' }),
    ...imResult.longTermRisks.map((risk) => new Paragraph({ text: `* ${risk}` })),
    new Paragraph({ text: '' }),
    new Paragraph({ text: 'Long term opportunities' }),
    ...imResult.longTermOpportunities.map((opp) => new Paragraph({ text: `* ${opp}` })),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Founders\' commitment to and company capacity on ESG risk management', bold: true }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: imResult.foundersCommitment }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Highlights of the relevant stakeholder consultations conducted, potential grievances, and risk of retaliation that could emerge and commitment to a stakeholder engagement plan.', bold: true }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: `Stakeholder Consultations: ${imResult.stakeholderConsultations}` }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: `Potential Grievances: ${imResult.potentialGrievances}` }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: `Risk of Retaliation: ${imResult.riskOfRetaliation}` }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Gaps in the fund\'s ESG requirements and proposed action plan to address gaps', bold: true }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: 'Gaps:' }),
    ...imResult.gaps.map((gap) => new Paragraph({ text: `* ${gap}` })),
    new Paragraph({ text: '' }),
    new Paragraph({ text: 'Action Plan:' }),
    ...imResult.actionPlan.map((action) => new Paragraph({ text: `* ${action}` })),
  ];

  sections.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Estimated cost of corrective actions and timeframe', bold: true }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
  );

  if (imResult.estimatedCost && imResult.estimatedCost !== 'Not available') {
    sections.push(
      new Paragraph({ text: imResult.estimatedCost })
    );
  }
  
  if (imResult.timeframe) {
    sections.push(
      new Paragraph({ text: imResult.timeframe })
    );
  }

  if (imResult.limitations && imResult.limitations.length > 0) {
    sections.push(
      new Paragraph({ text: '' }),
      new Paragraph({ text: '' }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Limitation of ESG due diligence', bold: true }),
        ],
      }),
      new Paragraph({ text: '' }),
      ...imResult.limitations.map((lim, idx) => new Paragraph({ text: `${idx + 1}. ${lim}` }))
    );
  }

  const doc = new Document({
    sections: [
      {
        children: sections,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

