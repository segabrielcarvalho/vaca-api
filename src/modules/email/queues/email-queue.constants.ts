export const EMAIL_QUEUE_JOB = {
   SEND: 'email.send',
} as const;

export type EmailQueuePayload = {
   to: string;
   subject: string;
   html: string;
};
