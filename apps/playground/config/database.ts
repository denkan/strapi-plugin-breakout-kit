// Version-tolerant sqlite config: the generated template used 5.53-only types
// (isDatabaseClientKind, typed connection records) which break the version matrix
// (supported window includes older 5.x). The playground only ever uses sqlite.
import path from 'path';

export default ({ env }: { env: (key: string, def?: string) => string }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      // Resolve from cwd, not __dirname: this config runs from dist/ under
      // `strapi develop` but from source when loaded programmatically (seed).
      filename: path.resolve(process.cwd(), env('DATABASE_FILENAME', '.tmp/data.db')),
    },
    useNullAsDefault: true,
    acquireConnectionTimeout: 60000,
  },
});
