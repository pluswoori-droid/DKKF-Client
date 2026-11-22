const authority = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
type OAuthData = Record<string, any>;

/** Display only diagnostic fields, never arbitrary OAuth bodies or credential fields. */
export function microsoftOAuthError(status: number, data: OAuthData): string {
  const description = typeof data.error_description === 'string' ? data.error_description : '';
  const code =
    (Array.isArray(data.error_codes) ? data.error_codes : []).find(
      (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0,
    ) ?? Number(description.match(/AADSTS(\d{4,10})\b/)?.[1] || 0);
  const error =
    typeof data.error === 'string' && /^[a-z_]{1,80}$/.test(data.error)
      ? data.error
      : 'oauth_error';
  let hint: string;
  if (code === 70002 || code === 7000218) {
    hint =
      'Azure → 앱 등록 → DKKF Client → 인증 → 공개 클라이언트 흐름 허용(Allow public client flows)을 예로 설정하고 저장하세요. 필요하면 모바일 및 데스크톱 애플리케이션 플랫폼을 추가하세요. 런처에 클라이언트 시크릿을 넣지 마세요.';
  } else if (code === 700016) {
    hint = 'Settings의 Client ID와 Azure 앱의 지원 계정 유형을 확인하세요.';
  } else if (error === 'invalid_scope') {
    hint = '앱 등록에서 XboxLive.signin 및 offline_access 요청이 허용되는지 확인하세요.';
  } else if (error === 'expired_token' || error === 'bad_verification_code') {
    hint = '로그인 코드가 만료되었거나 올바르지 않습니다. Microsoft 로그인을 다시 시작하세요.';
  } else if (error === 'authorization_declined' || error === 'access_denied') {
    hint = 'Microsoft 로그인 또는 동의가 거부되었습니다. 원하면 로그인을 다시 시작하세요.';
  } else if (error === 'invalid_grant') {
    hint = '저장된 인증을 갱신할 수 없습니다. Microsoft 계정으로 다시 로그인하세요.';
  } else if (error === 'invalid_client' || error === 'unauthorized_client') {
    hint =
      'Azure 앱의 Client ID, 개인 Microsoft 계정 지원, 공개 클라이언트 및 Device Code 흐름 설정을 확인하세요.';
  } else {
    hint = 'Microsoft 앱 인증 설정과 서비스 상태를 확인한 뒤 다시 시도하세요.';
  }
  return `Microsoft 인증 실패 (HTTP ${status}, ${error}${code ? ', AADSTS' + code : ''}). ${hint}`;
}

export async function postMicrosoftForm(
  endpoint: 'devicecode' | 'token',
  body: URLSearchParams,
  options: { allowPending?: boolean; fetcher?: typeof fetch } = {},
): Promise<OAuthData> {
  const res = await (options.fetcher ?? fetch)(`${authority}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  let data: OAuthData;
  try {
    const parsed: unknown = await res.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error();
    data = parsed as OAuthData;
  } catch {
    throw Error(`Microsoft 인증 응답 형식 오류 (HTTP ${res.status}). 잠시 후 다시 시도하세요.`);
  }
  if (!res.ok) {
    if (
      options.allowPending &&
      (data.error === 'authorization_pending' || data.error === 'slow_down')
    )
      return data;
    throw Error(microsoftOAuthError(res.status, data));
  }
  return data;
}
