/**
 * Company information structure
 */
export interface CompanyInfo {
  companyName: string;
  sector: string;
  subSector: string;
  countriesOfOperation: string[];
  numberOfEmployees: string;
  businessActivities: string;
  productDescription: string;
  currentESGPractices?: string;
  policies?: string;
  complianceStatus?: string;
  additionalInfo?: string;
}

/**
 * DDQ Assessment Result
 */
export interface DDQAssessment {
  area: string;
  definition: string;
  materiality: string;
  level: 'Level 0' | 'Level 1' | 'Level 2' | 'Level 3' | 'Non-existent';
  comments: string;
}

export interface DDQResult {
  riskManagement: DDQAssessment[];
  environment: DDQAssessment[];
  social: DDQAssessment[];
  governance: DDQAssessment[];
  trackRecord: {
    regulatoryBreaches?: string;
    supplyChainIssues?: string;
    transparencyDisclosure?: string;
    renewableEnergy?: string;
  };
}

/**
 * Investment Memo Result
 */
export interface IMResult {
  companyName: string;
  productActivitySolution: string;
  riskCategory: 'Category C' | 'Category B' | 'Category B+' | 'Category A';
  grievanceRedressMechanism: string;
  sector: string;
  subSector: string;
  countriesOfOperation: string;
  numberOfEmployees: string;
  currentRisks: string[];
  currentOpportunities: string[];
  longTermRisks: string[];
  longTermOpportunities: string[];
  foundersCommitment: string;
  stakeholderConsultations: string;
  potentialGrievances: string;
  riskOfRetaliation: string;
  gaps: string[];
  actionPlan: string[];
  estimatedCost?: string;
  timeframe?: string;
  limitations?: string[];
}

/**
 * Web Search Results
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevanceScore?: number;
}

export interface SearchResults {
  query: string;
  results: SearchResult[];
  timestamp: string;
}

