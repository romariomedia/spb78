export const LEGAL_COMPLIANCE_CHECKS=Object.freeze([
  'pdLocalizationConfirmed',
  'rknNotificationConfirmed',
  'crossBorderReviewed',
  'oriStatusReviewed',
  'publicDisseminationFlowReviewed',
  'ordIntegrationConfirmed',
  'kktFiscalizationConfirmed',
  'incidentPlanApproved',
  'retentionPolicyApproved',
  'lawyerReviewConfirmed',
  'accountantReviewConfirmed'
]);

const clean=(value,max=600)=>typeof value==='string'?value.trim().slice(0,max):'';

export function sanitizeLegalCompliance(input={},previous={}){
  const checks={};
  for(const key of LEGAL_COMPLIANCE_CHECKS){
    checks[key]=input?.checks?.[key]===undefined?previous?.checks?.[key]===true:input.checks[key]===true;
  }
  return {
    checks,
    evidence:{
      pdLocalization:clean(input?.evidence?.pdLocalization??previous?.evidence?.pdLocalization,600),
      rkn:clean(input?.evidence?.rkn??previous?.evidence?.rkn,600),
      crossBorder:clean(input?.evidence?.crossBorder??previous?.evidence?.crossBorder,600),
      ori:clean(input?.evidence?.ori??previous?.evidence?.ori,600),
      ord:clean(input?.evidence?.ord??previous?.evidence?.ord,600),
      kkt:clean(input?.evidence?.kkt??previous?.evidence?.kkt,600),
      lawyer:clean(input?.evidence?.lawyer??previous?.evidence?.lawyer,600),
      accountant:clean(input?.evidence?.accountant??previous?.evidence?.accountant,600)
    },
    notes:clean(input?.notes??previous?.notes,1200)
  };
}

export function legalEnvironmentReadiness(env=process.env){
  const vat=Number(env.YOOKASSA_VAT_CODE);
  const tax=Number(env.YOOKASSA_TAX_SYSTEM_CODE||0);
  const allowedPaymentModes=new Set(['full_payment','full_prepayment','prepayment','advance','partial_payment','credit','credit_payment']);
  return {
    legalGate:env.SB_LEGAL_COMPLIANCE_READY==='true',
    adMarkingGate:env.SB_AD_MARKING_READY==='true',
    yookassaConfigured:Boolean(env.YOOKASSA_SHOP_ID&&env.YOOKASSA_SECRET_KEY),
    receiptMode:env.YOOKASSA_RECEIPT_MODE==='yookassa',
    vatConfigured:Number.isInteger(vat)&&vat>=1&&vat<=12,
    paymentModeConfigured:allowedPaymentModes.has(String(env.YOOKASSA_PAYMENT_MODE||'')),
    taxSystemConfigured:tax===0||(Number.isInteger(tax)&&tax>=1&&tax<=6)
  };
}

export function legalChecklistComplete(value={}){
  return LEGAL_COMPLIANCE_CHECKS.every(key=>value?.checks?.[key]===true);
}
