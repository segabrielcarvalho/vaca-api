import { registerAs } from '@nestjs/config';

const googleAuthConfig = registerAs('googleAuth', () => ({
   clientId: process.env.GOOGLE_CLIENT_ID,
   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
   callbackUrl: process.env.GOOGLE_CALLBACK_URL,
   redirectUrl: process.env.GOOGLE_REDIRECT_URL,
}));

export default googleAuthConfig;
