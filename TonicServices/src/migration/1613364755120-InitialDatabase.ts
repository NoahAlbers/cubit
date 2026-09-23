import {MigrationInterface, QueryRunner} from "typeorm";

export class InitialDatabase1613364755120 implements MigrationInterface {
    name = 'InitialDatabase1613364755120'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("CREATE TABLE `plan` (`id` int NOT NULL AUTO_INCREMENT, `name` varchar(255) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `member_plan` (`id` int NOT NULL AUTO_INCREMENT, `startDate` datetime NOT NULL, `endDate` datetime NULL, `memberId` int NULL, `planId` int NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `transaction` (`id` int NOT NULL AUTO_INCREMENT, `amount` int NOT NULL, `confirmation` varchar(255) NULL, `transactionDate` datetime NOT NULL, `description` varchar(255) NULL, `method` varchar(255) NULL, `paypalEmail` varchar(255) NULL, `paypalMemberId` int NULL, `paypalName` varchar(255) NULL, `memberId` int NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `access_log` (`id` int NOT NULL AUTO_INCREMENT, `message` varchar(255) NULL, `timestamp` timestamp NOT NULL DEFAULT Sun Feb 14 2021 23:52:35 GMT-0500 (Eastern Standard Time), `memberId` int NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `memberKey` (`id` int NOT NULL AUTO_INCREMENT, `serialNumber` varchar(255) NOT NULL, `status` varchar(255) NULL, `memberId` int NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `status` (`id` int NOT NULL AUTO_INCREMENT, `status` varchar(255) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("ALTER TABLE `member_plan` ADD CONSTRAINT `FK_f28ddbd996dce6d6d94032de14a` FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `member_plan` ADD CONSTRAINT `FK_081ca38371061ac1a018269f55e` FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `transaction` ADD CONSTRAINT `FK_766ddd676f52dbc7ad256828fd1` FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `access_log` ADD CONSTRAINT `FK_95782c054edeff412388949d1de` FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `memberKey` ADD CONSTRAINT `FK_e9df95225f96ea2b2a01ef5235e` FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `memberKey` DROP FOREIGN KEY `FK_e9df95225f96ea2b2a01ef5235e`");
        await queryRunner.query("ALTER TABLE `access_log` DROP FOREIGN KEY `FK_95782c054edeff412388949d1de`");
        await queryRunner.query("ALTER TABLE `transaction` DROP FOREIGN KEY `FK_766ddd676f52dbc7ad256828fd1`");
        await queryRunner.query("ALTER TABLE `member_plan` DROP FOREIGN KEY `FK_081ca38371061ac1a018269f55e`");
        await queryRunner.query("ALTER TABLE `member_plan` DROP FOREIGN KEY `FK_f28ddbd996dce6d6d94032de14a`");
        await queryRunner.query("DROP TABLE `status`");
        await queryRunner.query("DROP TABLE `memberKey`");
        await queryRunner.query("DROP TABLE `access_log`");
        await queryRunner.query("DROP TABLE `transaction`");
        await queryRunner.query("DROP TABLE `member_plan`");
        await queryRunner.query("DROP TABLE `plan`");
    }

}
