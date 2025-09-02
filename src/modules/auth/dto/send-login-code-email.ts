export interface SendLoginCodeEmail {
   code: string;
   to: { email: string; name: string };
}
