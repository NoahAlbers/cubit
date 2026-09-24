import { DefaultNamingStrategy } from 'typeorm';

// MySQL's Windows default is lower_case_table_names=1, including the original
// explicitly named memberKey table. Keep ORM metadata consistent with the DB.
export class WindowsNamingStrategy extends DefaultNamingStrategy {
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return super.tableName(targetName, userSpecifiedName).toLowerCase();
  }
}
