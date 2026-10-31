/** Same-tab/system-browser OAuth transaction: no third-party storage or popup dependency. */
const KEY = 'sportbuddy_vk_redirect_v1';
const TTL = 15 * 60 * 1000;

export interface VkAuthFlowContext {
  registrationMode: boolean;
  termsAccepted: boolean;
  personalDataAccepted: boolean;
}

interface Transaction {
  state: string;
  codeVerifier: string;
  redirectUrl: string;
  createdAt: number;
  flow: VkAuthFlowContext;
}

const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');

function normalizeFlow(value?: Partial<VkAuthFlowContext>): VkAuthFlowContext {
  return {
    registrationMode: value?.registrationMode === true,
    termsAccepted: value?.termsAccepted === true,
    personalDataAccepted: value?.personalDataAccepted === true
  };
}

export function beginVkRedirect(
  storage: Storage,
  redirectUrl: string,
  flow: Partial<VkAuthFlowContext> = {}
): Transaction {
  const tx = {
    state: random(),
    codeVerifier: random(),
    redirectUrl,
    createdAt: Date.now(),
    flow: normalizeFlow(flow)
  };
  const serialized = JSON.stringify(tx);
  storage.setItem(KEY, serialized);
  if (storage.getItem(KEY) !== serialized) throw new Error('storage');
  return tx;
}

export function consumeVkRedirect(storage: Storage, url: URL): Transaction {
  const raw = storage.getItem(KEY);
  storage.removeItem(KEY);
  if (!raw) throw new Error('missing transaction');
  const parsed = JSON.parse(raw) as Partial<Transaction>;
  const tx: Transaction = {
    state: String(parsed.state || ''),
    codeVerifier: String(parsed.codeVerifier || ''),
    redirectUrl: String(parsed.redirectUrl || ''),
    createdAt: Number(parsed.createdAt),
    flow: normalizeFlow(parsed.flow)
  };
  if (!tx.state || !tx.codeVerifier || !Number.isFinite(tx.createdAt) ||
      Date.now() - tx.createdAt > TTL || Date.now() < tx.createdAt ||
      url.searchParams.get('state') !== tx.state ||
      new URL(tx.redirectUrl).origin !== url.origin ||
      new URL(tx.redirectUrl).pathname !== url.pathname) throw new Error('invalid transaction');
  return tx;
}

export function cleanVkCallback(url: URL): string {
  for (const key of ['code', 'state', 'device_id', 'type', 'expires_in', 'error', 'error_description', 'ext_id']) url.searchParams.delete(key);
  return url.pathname + url.search + url.hash;
}
