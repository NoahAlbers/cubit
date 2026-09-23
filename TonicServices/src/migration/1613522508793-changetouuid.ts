import {MigrationInterface, QueryRunner} from "typeorm";

export class changetouuid1613522508793 implements MigrationInterface {
    name = 'changetouuid1613522508793'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `member` ADD `id` varchar(36) NOT NULL PRIMARY KEY");
        await queryRunner.query("ALTER TABLE `access_log` CHANGE `timestamp` `timestamp` datetime NOT NULL DEFAULT NOW()");
        await queryRunner.query("ALTER TABLE `memberKey` DROP COLUMN `memberId`");
        await queryRunner.query("ALTER TABLE `memberKey` ADD `memberId` varchar(36) NULL");
        await queryRunner.query("ALTER TABLE `member_plan` ADD CONSTRAINT `FK_f28ddbd996dce6d6d94032de14a` FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `transaction` ADD CONSTRAINT `FK_766ddd676f52dbc7ad256828fd1` FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `access_log` ADD CONSTRAINT `FK_95782c054edeff412388949d1de` FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `memberKey` ADD CONSTRAINT `FK_e9df95225f96ea2b2a01ef5235e` FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `memberKey` DROP FOREIGN KEY `FK_e9df95225f96ea2b2a01ef5235e`");
        await queryRunner.query("ALTER TABLE `access_log` DROP FOREIGN KEY `FK_95782c054edeff412388949d1de`");
        await queryRunner.query("ALTER TABLE `transaction` DROP FOREIGN KEY `FK_766ddd676f52dbc7ad256828fd1`");
        await queryRunner.query("ALTER TABLE `member_plan` DROP FOREIGN KEY `FK_f28ddbd996dce6d6d94032de14a`");
        await queryRunner.query("ALTER TABLE `memberKey` DROP COLUMN `memberId`");
        await queryRunner.query("ALTER TABLE `memberKey` ADD `memberId` int NULL");
        await queryRunner.query("ALTER TABLE `access_log` CHANGE `timestamp` `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP");
        await queryRunner.query("ALTER TABLE `member` DROP COLUMN `id`");
    }

}
