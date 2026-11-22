import { useI18n } from './i18n';
import type { Account } from '../../shared/types';
export function PlayerFace({ account, size = 32 }: { account: Account; size?: number }) {
  const t = useI18n();
  const face = account.skinFace?.startsWith('data:image/png;base64,')
    ? account.skinFace
    : undefined;
  return face ? (
    <img
      className="skin-face"
      src={face}
      alt={t('{0} 스킨 얼굴', account.name)}
      width={size}
      height={size}
    />
  ) : (
    <span
      className="avatar"
      style={{ width: size, height: size }}
      role="img"
      aria-label={t('스킨 얼굴을 불러올 수 없음')}
    >
      {account.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
export function AccountIdentity({ account }: { account?: Account }) {
  const t = useI18n();
  if (!account) return null;
  return (
    <div className="header-profile" aria-label={t('연결된 Minecraft 계정')}>
      <PlayerFace account={account} />
      <span className="profile-name" title={account.name}>
        {account.name}
      </span>
    </div>
  );
}
