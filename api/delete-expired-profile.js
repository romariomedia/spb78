// Automatic destructive deletion is retired. Existing shared content must be
// reviewed through the authenticated administrator lifecycle workflow.
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json({deleted:false, reviewRequired:true,
    code:'ACCOUNT_DELETION_REQUIRES_REVIEW',
    message:'Срок верификации истёк. Для восстановления аккаунта обратитесь в support@sportbuddy78.ru. Данные не удалены.'});
}
