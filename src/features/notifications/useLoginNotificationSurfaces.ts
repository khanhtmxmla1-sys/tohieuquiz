import { useEffect, useState } from 'react';
import type { Announcement } from '../../services/announcementService';
import { getAnnouncements } from '../../services/announcementService';
import { selectAnnouncementSurfaces } from './selectAnnouncements';

export type LoginNotificationRole = 'student' | 'teacher';

export interface LoginNotificationSurfaces {
  critical: Announcement | null;
  notice: Announcement | null;
}

const EMPTY_SURFACES: LoginNotificationSurfaces = {
  critical: null,
  notice: null,
};

/**
 * Resolves the public announcements for the currently selected login role.
 *
 * Login deliberately has no ticker surface: a ticker announcement is rendered
 * as a static notice card in the form so that the sign-in action stays calm and
 * readable. The critical strip remains outside the form, directly below the
 * landing header.
 */
export function useLoginNotificationSurfaces(
  role: LoginNotificationRole,
  enabled = true,
): LoginNotificationSurfaces {
  const [surfaces, setSurfaces] = useState<LoginNotificationSurfaces>(EMPTY_SURFACES);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setSurfaces(EMPTY_SURFACES);
      return () => { active = false; };
    }

    setSurfaces(EMPTY_SURFACES);
    void getAnnouncements(role)
      .then((items) => {
        if (!active) return;
        const selected = selectAnnouncementSurfaces(items, 'LOGIN');
        setSurfaces({
          critical: selected.critical,
          notice: selected.banner ?? selected.ticker,
        });
      })
      .catch((error) => {
        if (!active) return;
        console.warn('[Notifications] login announcement collection unavailable', error);
        setSurfaces(EMPTY_SURFACES);
      });

    return () => { active = false; };
  }, [enabled, role]);

  return surfaces;
}
