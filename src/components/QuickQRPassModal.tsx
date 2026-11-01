import React from 'react';
import { useT } from '../i18n';
import { Link } from '../router';
import { Modal } from './ui';
import { FanClubCheckInCard } from './FanClubCheckInCard';

/** The fan club pass in a pop-up, opened from the floating QR button on any page. */
export function QuickQRPassModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Modal open={isOpen} onClose={onClose} title={t('Fan club pass')}>
      <div className="space-y-3">
        <FanClubCheckInCard compact />
        <Link to="/fanclub" onClick={onClose} className="block text-center text-sm font-bold text-amber-300 underline">
          {t('Fan clubs and offers')}
        </Link>
      </div>
    </Modal>
  );
}
