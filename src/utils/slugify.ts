async function slugify(name: string) {
   const DIACRITICS = /[\u0300-\u036f]/g;
   const NON_ALNUM = /[^a-z0-9]+/g;
   const MULTI_HYPHEN = /-+/g;
   const TRIM_HYPHEN = /^-|-$/g;

   return name
      .normalize('NFD')
      .replace(DIACRITICS, '')
      .toLowerCase()
      .replace(NON_ALNUM, '-')
      .replace(MULTI_HYPHEN, '-')
      .replace(TRIM_HYPHEN, '');
}

export default slugify;
