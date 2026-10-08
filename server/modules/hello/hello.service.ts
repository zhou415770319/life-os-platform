// /* 模板代码 仅作示例 */
// import { Injectable, Inject, Logger } from '@nestjs/common';
// import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
// import { record } from '@server/database/schema';
// import { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql } from '@server/storage/drizzle-compat';

// @Injectable()
// export class HelloService {
//   private readonly logger = new Logger(HelloService.name);

//   constructor(@Inject(LOCAL_DATABASE) private readonly db: LocalDatabase) {}

//   async test(userId: string, limit: number = 5) {
//     try {
//       const results = await this.db
//         .select()
//         .from(record)
//         .where(eq(record.userProfile, userId))
//         .orderBy(desc(record.speakDate))
//         .limit(limit);
  
//       return results;
//     } catch (error) {
//       this.logger.error('获取最近记录失败', error);
//       throw error;
//     }
//   }
// }

