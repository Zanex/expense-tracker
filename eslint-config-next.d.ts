declare module 'eslint-config-next/core-web-vitals' {
  import { Linter } from 'eslint';
  const config: Linter.Config[];
  export default config;
}

declare module 'eslint-config-next' {
  import { Linter } from 'eslint';
  const config: Linter.Config[];
  export default config;
}
