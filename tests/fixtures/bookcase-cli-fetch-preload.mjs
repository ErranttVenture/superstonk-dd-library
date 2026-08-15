const expectedUrl = 'https://fliphtml5.com/bookcase/kosyg';

globalThis.fetch = async (url) => {
  if (url !== expectedUrl) {
    throw new Error(`Unexpected bookcase URL: ${url}`);
  }
  return {
    ok: true,
    text: async () => process.env.BOOKCASE_CLI_HTML
  };
};
