import {adminPost} from './adminRequest';

export type LegalCheckKey=
  |'pdLocalizationConfirmed'
  |'rknNotificationConfirmed'
  |'crossBorderReviewed'
  |'oriStatusReviewed'
  |'publicDisseminationFlowReviewed'
  |'ordIntegrationConfirmed'
  |'kktFiscalizationConfirmed'
  |'incidentPlanApproved'
  |'retentionPolicyApproved'
  |'lawyerReviewConfirmed'
  |'accountantReviewConfirmed';

export interface LegalComplianceState{
  checks:Record<LegalCheckKey,boolean>;
  evidence:{
    pdLocalization:string;rkn:string;crossBorder:string;ori:string;ord:string;kkt:string;lawyer:string;accountant:string;
  };
  notes:string;
  updatedAt:string;
  updatedBy:string;
  checklistComplete:boolean;
}

export interface LegalEnvironmentReadiness{
  legalGate:boolean;
  adMarkingGate:boolean;
  yookassaConfigured:boolean;
  receiptMode:boolean;
  vatConfigured:boolean;
  paymentModeConfigured:boolean;
  taxSystemConfigured:boolean;
}

export interface AdminLegalCompliance{
  state:LegalComplianceState;
  environment:LegalEnvironmentReadiness;
  checkKeys:LegalCheckKey[];
}

export const loadAdminLegalCompliance=()=>adminPost<AdminLegalCompliance>('/api/admin-legal-compliance',{operation:'get'});

export const saveAdminLegalCompliance=(state:LegalComplianceState)=>adminPost<AdminLegalCompliance>('/api/admin-legal-compliance',{
  operation:'save',state,requestId:crypto.randomUUID?.()||String(Date.now())
});
