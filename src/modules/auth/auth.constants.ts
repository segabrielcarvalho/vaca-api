export const AUTH_COOKIE = {
   ACCESS: 'auth_access',
   REFRESH: 'auth_refresh',
   CSRF: 'csrf_token',
} as const;

export const AUTH_CONTEXT_SCOPE = {
   INVITE_ONBOARDING: 'invite_onboarding',
} as const;

export const AUTH_EMAIL_SUBJECT = {
   INVITE: 'Voce recebeu um convite',
   INVITE_VERIFICATION: 'Confirme seu convite',
   LOGIN_CHALLENGE: 'Codigo e link de acesso',
} as const;
