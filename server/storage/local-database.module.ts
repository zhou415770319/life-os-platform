import { Global, Module } from '@nestjs/common';
import { LocalDatabase } from './local-database';

export const LOCAL_DATABASE = 'LOCAL_DATABASE';

@Global()
@Module({
  providers: [{ provide: LOCAL_DATABASE, useClass: LocalDatabase }],
  exports: [LOCAL_DATABASE],
})
export class LocalDatabaseModule {}
